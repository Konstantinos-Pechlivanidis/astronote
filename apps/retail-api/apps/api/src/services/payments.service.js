const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'payments-service' });

const normalizeCurrency = (value) => {
  if (!value) {
    return 'EUR';
  }
  const normalized = String(value).toUpperCase();
  if (normalized === 'USD') {
    return 'USD';
  }
  if (normalized !== 'EUR') {
    logger.warn({ currency: normalized }, 'Unsupported currency for payment; defaulting to EUR');
  }
  return 'EUR';
};

const unixToDate = (value) => {
  if (!value) {
    return null;
  }
  return new Date(value * 1000);
};

const getEnv = (key) => {
  const value = process.env[key];
  return value ? String(value).trim() : null;
};

const resolvePaymentKindFromPriceId = (priceId) => {
  if (!priceId) {
    return null;
  }

  const monthlyPriceIds = [
    getEnv('STRIPE_PRICE_SUB_MONTHLY_EUR'),
    getEnv('STRIPE_PRICE_SUB_MONTHLY_USD'),
    getEnv('STRIPE_PRICE_ID_SUB_STARTER_EUR'),
    getEnv('STRIPE_PRICE_ID_SUB_STARTER_USD'),
    getEnv('STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR'),
    getEnv('STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD'),
  ].filter(Boolean);

  const yearlyPriceIds = [
    getEnv('STRIPE_PRICE_SUB_YEARLY_EUR'),
    getEnv('STRIPE_PRICE_SUB_YEARLY_USD'),
    getEnv('STRIPE_PRICE_ID_SUB_PRO_EUR'),
    getEnv('STRIPE_PRICE_ID_SUB_PRO_USD'),
    getEnv('STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR'),
    getEnv('STRIPE_PRICE_ID_SUB_PRO_YEAR_USD'),
  ].filter(Boolean);

  if (monthlyPriceIds.includes(priceId)) {
    return 'monthly';
  }
  if (yearlyPriceIds.includes(priceId)) {
    return 'yearly';
  }

  const planCatalog = require('./plan-catalog.service');
  const resolved = planCatalog.resolvePlanFromPriceId(priceId);
  if (resolved?.interval === 'month') {
    return 'monthly';
  }
  if (resolved?.interval === 'year') {
    return 'yearly';
  }

  return null;
};

const extractPriceIdFromInvoice = (invoice) => {
  const lines = invoice?.lines?.data;
  if (!Array.isArray(lines)) {
    return null;
  }

  const subscriptionLine = lines.find((line) => line?.type === 'subscription' && line?.price?.id);
  if (subscriptionLine?.price?.id) {
    return subscriptionLine.price.id;
  }

  const anyLine = lines.find((line) => line?.price?.id || line?.plan?.id);
  return anyLine?.price?.id || anyLine?.plan?.id || null;
};

const extractIntervalFromInvoice = (invoice) => {
  const lines = invoice?.lines?.data;
  if (!Array.isArray(lines)) {
    return null;
  }

  const subscriptionLine = lines.find((line) => line?.type === 'subscription');
  const interval =
    subscriptionLine?.price?.recurring?.interval ||
    subscriptionLine?.plan?.interval ||
    lines[0]?.price?.recurring?.interval ||
    lines[0]?.plan?.interval;

  if (interval === 'month' || interval === 'year') {
    return interval;
  }

  return null;
};

const resolveSubscriptionPaymentKind = (invoice, priceId, options = {}) => {
  const interval = extractIntervalFromInvoice(invoice);
  if (interval === 'month') {
    return 'monthly';
  }
  if (interval === 'year') {
    return 'yearly';
  }

  const resolvedFromPrice = resolvePaymentKindFromPriceId(priceId);
  if (resolvedFromPrice) {
    return resolvedFromPrice;
  }

  const fallbackInterval = options.fallbackInterval;
  if (fallbackInterval === 'month') {
    return 'monthly';
  }
  if (fallbackInterval === 'year') {
    return 'yearly';
  }

  const fallbackPlanType = options.fallbackPlanType;
  if (fallbackPlanType) {
    const { getIntervalForPlan } = require('./subscription.service');
    const derived = getIntervalForPlan(fallbackPlanType);
    if (derived === 'month') {
      return 'monthly';
    }
    if (derived === 'year') {
      return 'yearly';
    }
  }

  return null;
};

const findExistingPayment = async ({ stripeInvoiceId, stripeSessionId, stripePaymentIntentId }) => {
  if (stripeInvoiceId) {
    return prisma.payment.findUnique({ where: { stripeInvoiceId } });
  }
  if (stripeSessionId) {
    return prisma.payment.findUnique({ where: { stripeSessionId } });
  }
  if (stripePaymentIntentId) {
    return prisma.payment.findUnique({ where: { stripePaymentIntentId } });
  }
  return null;
};

const createPaymentRecord = async (data) => {
  const {
    ownerId,
    kind,
    amount,
    currency,
    paidAt,
    priceId,
    stripeInvoiceId,
    stripeSessionId,
    stripePaymentIntentId,
    stripeChargeId,
    stripeCustomerId,
    stripeSubscriptionId,
  } = data;

  if (!ownerId || !kind || !Number.isFinite(amount)) {
    throw new Error('Invalid payment payload');
  }

  if (!stripeInvoiceId && !stripeSessionId && !stripePaymentIntentId) {
    logger.warn({ ownerId, kind }, 'Payment missing Stripe identifiers; skipping record to avoid duplicates');
    return null;
  }

  try {
    return await prisma.payment.create({
      data: {
        ownerId,
        kind,
        amount,
        currency,
        paidAt,
        priceId: priceId || null,
        stripeInvoiceId: stripeInvoiceId || null,
        stripeSessionId: stripeSessionId || null,
        stripePaymentIntentId: stripePaymentIntentId || null,
        stripeChargeId: stripeChargeId || null,
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubscriptionId || null,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return findExistingPayment({ stripeInvoiceId, stripeSessionId, stripePaymentIntentId });
    }
    logger.error({ ownerId, kind, error: error.message }, 'Failed to record payment');
    throw error;
  }
};

const createPaymentFromInvoice = async (ownerId, invoice, options = {}) => {
  if (!invoice?.id) {
    throw new Error('Invoice ID is required');
  }

  const priceId = extractPriceIdFromInvoice(invoice);
  const kind = resolveSubscriptionPaymentKind(invoice, priceId, options);
  if (!kind) {
    logger.warn({ ownerId, invoiceId: invoice.id, priceId }, 'Unable to resolve subscription payment kind');
    return null;
  }

  const amount =
    typeof invoice.amount_paid === 'number'
      ? invoice.amount_paid
      : typeof invoice.total === 'number'
        ? invoice.total
        : 0;
  const paidAt =
    unixToDate(invoice.status_transitions?.paid_at) ||
    unixToDate(invoice.created) ||
    new Date();

  return createPaymentRecord({
    ownerId,
    kind,
    amount,
    currency: normalizeCurrency(invoice.currency),
    paidAt,
    priceId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent || null,
    stripeChargeId: invoice.charge || null,
    stripeCustomerId: invoice.customer || null,
    stripeSubscriptionId: invoice.subscription || null,
  });
};

const getSubscriptionPaymentKind = (invoice, options = {}) => {
  const priceId = extractPriceIdFromInvoice(invoice);
  const kind = resolveSubscriptionPaymentKind(invoice, priceId, options);
  return { kind, priceId };
};

const createPaymentFromCheckoutSession = async (ownerId, session, options = {}) => {
  if (!session?.id) {
    throw new Error('Session ID is required');
  }

  const kind = options.kind;
  if (!kind) {
    throw new Error('Payment kind is required');
  }

  const paidAt = unixToDate(session.created) || new Date();
  const amount = typeof session.amount_total === 'number' ? session.amount_total : 0;
  const metadata = session.metadata || {};
  const priceId = metadata.priceId || null;

  return createPaymentRecord({
    ownerId,
    kind,
    amount,
    currency: normalizeCurrency(session.currency || metadata.currency),
    paidAt,
    priceId,
    stripeSessionId: session.id,
    stripePaymentIntentId: session.payment_intent || null,
    stripeCustomerId: session.customer || null,
  });
};

module.exports = {
  normalizeCurrency,
  resolvePaymentKindFromPriceId,
  createPaymentRecord,
  createPaymentFromInvoice,
  createPaymentFromCheckoutSession,
  getSubscriptionPaymentKind,
};
