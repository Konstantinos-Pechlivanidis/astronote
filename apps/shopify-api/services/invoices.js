import prisma from './prisma.js';
import { logger } from '../utils/logger.js';

const normalizeCurrency = (value) => {
  if (!value) return null;
  return String(value).toUpperCase();
};

const unixToDate = (value) => {
  if (!value) return null;
  return new Date(value * 1000);
};

export async function upsertInvoiceRecord(shopId, invoice, options = {}) {
  if (!invoice?.id) {
    throw new Error('Invoice ID is required');
  }

  const issuedAt =
    unixToDate(invoice.status_transitions?.finalized_at) ||
    unixToDate(invoice.created) ||
    null;

  const payload = {
    shopId,
    stripeInvoiceId: invoice.id,
    stripeCustomerId: invoice.customer || null,
    stripeSubscriptionId: invoice.subscription || null,
    invoiceNumber: invoice.number || null,
    subtotal: invoice.subtotal ?? null,
    tax: invoice.tax ?? null,
    total: invoice.total ?? null,
    currency: normalizeCurrency(invoice.currency),
    pdfUrl: invoice.invoice_pdf || null,
    hostedInvoiceUrl: invoice.hosted_invoice_url || null,
    status: invoice.status || null,
    issuedAt,
  };

  const record = await prisma.invoiceRecord.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: payload,
    create: payload,
  });

  if (options.taxEvidenceId) {
    await prisma.invoiceRecord.update({
      where: { id: record.id },
      data: { taxEvidence: { connect: { id: options.taxEvidenceId } } },
    });
  }

  logger.info(
    { shopId, invoiceId: invoice.id, status: invoice.status },
    'Invoice record upserted',
  );

  return record;
}

export async function recordSubscriptionInvoiceTransaction(
  shopId,
  invoice,
  options = {},
) {
  if (!invoice?.id) {
    throw new Error('Invoice ID is required');
  }

  const creditsAdded = Number.isFinite(options.creditsAdded)
    ? Number(options.creditsAdded)
    : 0;
  const currency = normalizeCurrency(invoice.currency) || 'EUR';
  const amount =
    typeof invoice.amount_paid === 'number'
      ? invoice.amount_paid
      : typeof invoice.total === 'number'
        ? invoice.total
        : 0;

  const idempotencyKey = `stripe:invoice:${invoice.id}`;

  try {
    return await prisma.billingTransaction.create({
      data: {
        shopId,
        creditsAdded,
        amount,
        currency,
        packageType: 'subscription',
        stripeSessionId: invoice.id,
        stripePaymentId: invoice.payment_intent || null,
        idempotencyKey,
        status: 'completed',
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return prisma.billingTransaction.findFirst({
        where: { shopId, idempotencyKey },
      });
    }
    logger.error('Failed to record subscription invoice transaction', {
      shopId,
      invoiceId: invoice.id,
      error: error.message,
    });
    throw error;
  }
}

export async function listInvoices(shopId, filters = {}) {
  const { page = 1, pageSize = 20, status } = filters;

  const where = { shopId };
  if (status) {
    where.status = status;
  }

  const [invoices, total] = await Promise.all([
    prisma.invoiceRecord.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      take: Number(pageSize),
      skip: (Number(page) - 1) * Number(pageSize),
    }),
    prisma.invoiceRecord.count({ where }),
  ]);

  const totalPages = Math.ceil(total / Number(pageSize));

  const normalizedInvoices = invoices.map((invoice) => ({
    ...invoice,
    subtotal: Number.isFinite(invoice.subtotal)
      ? Number((invoice.subtotal / 100).toFixed(2))
      : null,
    tax: Number.isFinite(invoice.tax)
      ? Number((invoice.tax / 100).toFixed(2))
      : null,
    total: Number.isFinite(invoice.total)
      ? Number((invoice.total / 100).toFixed(2))
      : null,
    currency: invoice.currency ? invoice.currency.toUpperCase() : null,
  }));

  return {
    invoices: normalizedInvoices,
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages,
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    },
  };
}

export default {
  upsertInvoiceRecord,
  recordSubscriptionInvoiceTransaction,
  listInvoices,
};
