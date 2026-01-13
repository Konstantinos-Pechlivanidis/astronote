const prisma = require('../lib/prisma');
const pino = require('pino');
const { credit } = require('./wallet.service');

const logger = pino({ name: 'invoices-service' });

const normalizeCurrency = (value) => {
  if (!value) {return null;}
  return String(value).toUpperCase();
};

const unixToDate = (value) => {
  if (!value) {return null;}
  return new Date(value * 1000);
};

async function upsertInvoiceRecord(ownerId, invoice, options = {}) {
  if (!invoice?.id) {
    throw new Error('Invoice ID is required');
  }

  const issuedAt =
    unixToDate(invoice.status_transitions?.finalized_at) ||
    unixToDate(invoice.created) ||
    null;

  const payload = {
    ownerId,
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

  logger.info({ ownerId, invoiceId: invoice.id, status: invoice.status }, 'Invoice record upserted');

  return record;
}

async function recordSubscriptionInvoiceTransaction(ownerId, invoice, options = {}) {
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
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.billingTransaction.create({
        data: {
          ownerId,
          creditsAdded,
          amount,
          currency,
          packageType: 'subscription',
          stripeSessionId: invoice.id,
          stripePaymentId: invoice.payment_intent || null,
          idempotencyKey,
          status: 'paid',
        },
      });

      if (creditsAdded > 0) {
        await credit(
          ownerId,
          creditsAdded,
          {
            reason: 'subscription:cycle',
            meta: {
              invoiceId: invoice.id,
              subscriptionId: invoice.subscription || null,
            },
          },
          tx,
        );
      }

      return transaction;
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return prisma.billingTransaction.findFirst({
        where: { ownerId, idempotencyKey },
      });
    }
    logger.error('Failed to record subscription invoice transaction', {
      ownerId,
      invoiceId: invoice.id,
      error: error.message,
    });
    throw error;
  }
}

async function listInvoices(ownerId, filters = {}) {
  const { page = 1, pageSize = 20, status } = filters;

  const where = { ownerId };
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

module.exports = {
  upsertInvoiceRecord,
  recordSubscriptionInvoiceTransaction,
  listInvoices,
};
