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

/**
 * Record free credits grant as a purchase history entry
 * Creates a BillingTransaction with amount=0 but creditsGranted>0
 * @param {string} shopId - Shop ID
 * @param {string} planType - Plan type (starter/pro)
 * @param {number} creditsGranted - Number of credits granted
 * @param {string} invoiceId - Stripe invoice ID (for idempotency)
 * @param {Object} periodInfo - Period information
 * @returns {Promise<Object>} Created transaction
 */
export async function recordFreeCreditsGrant(
  shopId,
  planType,
  creditsGranted,
  invoiceId,
  periodInfo = {},
) {
  if (!creditsGranted || creditsGranted <= 0) {
    return null;
  }

  const idempotencyKey = invoiceId
    ? `free_credits:invoice:${invoiceId}`
    : `free_credits:${planType}:${periodInfo.periodStart || Date.now()}`;

  try {
    return await prisma.billingTransaction.create({
      data: {
        shopId,
        creditsAdded: creditsGranted,
        amount: 0, // Free credits have no monetary amount
        currency: 'EUR',
        packageType: `subscription_included_${planType}`,
        stripeSessionId: invoiceId || `free_${Date.now()}`,
        stripePaymentId: null,
        idempotencyKey,
        status: 'completed',
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      // Already recorded, return existing
      return prisma.billingTransaction.findFirst({
        where: { shopId, idempotencyKey },
      });
    }
    logger.error('Failed to record free credits grant', {
      shopId,
      planType,
      creditsGranted,
      invoiceId,
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

  // If DB is empty, try to fetch from Stripe and sync
  if (total === 0) {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { stripeCustomerId: true },
      });

      if (shop?.stripeCustomerId) {
        logger.info(
          { shopId, stripeCustomerId: shop.stripeCustomerId },
          'No invoices in DB, fetching from Stripe as fallback',
        );

        let stripe = null;
        try {
          const stripeModule = await import('stripe');
          const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
          if (stripeSecretKey) {
            stripe = stripeModule.default(stripeSecretKey);
          }
        } catch (err) {
          logger.warn('Stripe not configured, skipping fallback fetch');
        }

        if (stripe) {
          try {
            const stripeInvoices = await stripe.invoices.list({
              customer: shop.stripeCustomerId,
              limit: Number(pageSize),
            });

            // Sync invoices to DB
            for (const invoice of stripeInvoices.data) {
              try {
                await upsertInvoiceRecord(shopId, invoice);
              } catch (err) {
                logger.warn(
                  { shopId, invoiceId: invoice.id, err: err.message },
                  'Failed to sync invoice from Stripe',
                );
              }
            }

            // Re-fetch from DB after sync
            const [syncedInvoices, syncedTotal] = await Promise.all([
              prisma.invoiceRecord.findMany({
                where,
                orderBy: { issuedAt: 'desc' },
                take: Number(pageSize),
                skip: (Number(page) - 1) * Number(pageSize),
              }),
              prisma.invoiceRecord.count({ where }),
            ]);

            const normalizedInvoices = syncedInvoices.map((invoice) => ({
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
                total: syncedTotal,
                totalPages: Math.ceil(syncedTotal / Number(pageSize)),
                hasNextPage: Number(page) < Math.ceil(syncedTotal / Number(pageSize)),
                hasPrevPage: Number(page) > 1,
              },
            };
          } catch (stripeErr) {
            logger.warn(
              { shopId, err: stripeErr.message },
              'Failed to fetch invoices from Stripe',
            );
            // Fall through to return empty result
          }
        }
      }
    } catch (err) {
      logger.warn(
        { shopId, err: err.message },
        'Failed to fetch invoices from Stripe fallback',
      );
      // Fall through to return empty result
    }
  }

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
  recordFreeCreditsGrant,
  listInvoices,
};
