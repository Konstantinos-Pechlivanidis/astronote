const prisma = require('../lib/prisma');
const pino = require('pino');

const logger = pino({ name: 'billing-export' });

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDateInput = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (DATE_ONLY_RE.test(raw)) {
    const [year, month, day] = raw.split('-').map((entry) => Number(entry));
    if (!year || !month || !day) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (endOfDay) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return date;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const normalizeRange = ({ start, end }) => {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  if (startDate >= endDate) {
    return null;
  }
  return { start: startDate, end: endDate };
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
};

const formatMoney = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  return (value / 100).toFixed(2);
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (rows, columns) => {
  const header = columns.map((col) => csvEscape(col)).join(',');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n');
};

const normalizeAddress = (value) => {
  if (!value) {
    return {};
  }
  const address = typeof value === 'string'
    ? (() => {
      try {
        return JSON.parse(value);
      } catch (err) {
        return {};
      }
    })()
    : value;

  return {
    line1: address.line1 || null,
    line2: address.line2 || null,
    city: address.city || null,
    state: address.state || null,
    postalCode: address.postalCode || address.postal_code || null,
    country: address.country ? String(address.country).toUpperCase() : null,
  };
};

const getWeeklyRange = (now = new Date()) => {
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = utcMidnight.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const startOfThisWeek = new Date(utcMidnight);
  startOfThisWeek.setUTCDate(utcMidnight.getUTCDate() - daysSinceMonday);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setUTCDate(startOfThisWeek.getUTCDate() - 7);

  return {
    start: startOfLastWeek,
    end: startOfThisWeek,
  };
};

const mapBillingTransactions = (transactions) => {
  const creditsBySession = new Map();
  const creditsByPayment = new Map();

  for (const txn of transactions) {
    if (txn.stripeSessionId) {
      creditsBySession.set(
        txn.stripeSessionId,
        (creditsBySession.get(txn.stripeSessionId) || 0) + (txn.creditsAdded || 0),
      );
    }
    if (txn.stripePaymentId) {
      creditsByPayment.set(
        txn.stripePaymentId,
        (creditsByPayment.get(txn.stripePaymentId) || 0) + (txn.creditsAdded || 0),
      );
    }
  }

  return { creditsBySession, creditsByPayment };
};

const collectPaymentIds = (payments) => {
  const sessionIds = new Set();
  const paymentIntentIds = new Set();
  const invoiceIds = new Set();

  for (const payment of payments) {
    if (payment.stripeInvoiceId) {
      sessionIds.add(payment.stripeInvoiceId);
      invoiceIds.add(payment.stripeInvoiceId);
    }
    if (payment.stripeSessionId) {
      sessionIds.add(payment.stripeSessionId);
    }
    if (payment.stripePaymentIntentId) {
      paymentIntentIds.add(payment.stripePaymentIntentId);
    }
  }

  return {
    sessionIds: Array.from(sessionIds),
    paymentIntentIds: Array.from(paymentIntentIds),
    invoiceIds: Array.from(invoiceIds),
  };
};

const buildPaymentRows = ({ payments, billingProfiles, invoiceMap, creditsBySession, creditsByPayment }) => {
  return payments.map((payment) => {
    const ownerId = payment.ownerId;
    const owner = payment.owner || {};
    const billingProfile = billingProfiles.get(ownerId) || null;
    const address = normalizeAddress(billingProfile?.billingAddress);
    const invoice = payment.stripeInvoiceId ? invoiceMap.get(payment.stripeInvoiceId) : null;

    const creditIds = new Set();
    if (payment.stripeInvoiceId) {
      creditIds.add(payment.stripeInvoiceId);
    }
    if (payment.stripeSessionId) {
      creditIds.add(payment.stripeSessionId);
    }

    let creditsGranted = 0;
    for (const creditId of creditIds) {
      creditsGranted += creditsBySession.get(creditId) || 0;
    }
    if (payment.stripePaymentIntentId) {
      creditsGranted += creditsByPayment.get(payment.stripePaymentIntentId) || 0;
    }

    return {
      owner_id: ownerId,
      payment_id: payment.id,
      paid_at: formatDate(payment.paidAt),
      kind: payment.kind,
      amount_cents: payment.amount,
      amount_decimal: formatMoney(payment.amount),
      currency: payment.currency || '',
      status: payment.status || '',
      credits_granted: creditsGranted,
      price_id: payment.priceId || '',
      stripe_invoice_id: payment.stripeInvoiceId || '',
      stripe_session_id: payment.stripeSessionId || '',
      stripe_payment_intent_id: payment.stripePaymentIntentId || '',
      stripe_charge_id: payment.stripeChargeId || '',
      stripe_customer_id: payment.stripeCustomerId || '',
      stripe_subscription_id: payment.stripeSubscriptionId || '',
      invoice_number: invoice?.invoiceNumber || '',
      invoice_status: invoice?.status || '',
      invoice_subtotal_cents: invoice?.subtotal ?? '',
      invoice_subtotal_decimal: Number.isFinite(invoice?.subtotal) ? formatMoney(invoice.subtotal) : '',
      invoice_tax_cents: invoice?.tax ?? '',
      invoice_tax_decimal: Number.isFinite(invoice?.tax) ? formatMoney(invoice.tax) : '',
      invoice_total_cents: invoice?.total ?? '',
      invoice_total_decimal: Number.isFinite(invoice?.total) ? formatMoney(invoice.total) : '',
      invoice_currency: invoice?.currency || '',
      invoice_issued_at: formatDate(invoice?.issuedAt),
      billing_legal_name: billingProfile?.legalName || '',
      billing_vat_number: billingProfile?.vatNumber || '',
      billing_vat_country: billingProfile?.vatCountry || '',
      billing_tax_status: billingProfile?.taxStatus || '',
      billing_tax_exempt: billingProfile?.taxExempt ?? '',
      billing_is_business: billingProfile?.isBusiness ?? '',
      billing_email: billingProfile?.billingEmail || '',
      billing_address_line1: address.line1 || '',
      billing_address_line2: address.line2 || '',
      billing_city: address.city || '',
      billing_state: address.state || '',
      billing_postal_code: address.postalCode || '',
      billing_country: address.country || '',
      user_email: owner.email || '',
      user_company: owner.company || '',
    };
  });
};

const buildRefundRows = ({ adjustments, billingProfiles, paymentMap }) => {
  return adjustments.map((adjustment) => {
    const payment = adjustment.paymentId ? paymentMap.get(adjustment.paymentId) : null;
    const ownerId = adjustment.ownerId || payment?.ownerId;
    const billingProfile = ownerId ? billingProfiles.get(ownerId) : null;
    const address = normalizeAddress(billingProfile?.billingAddress);

    return {
      owner_id: ownerId || '',
      adjustment_id: adjustment.id,
      occurred_at: formatDate(adjustment.occurredAt),
      type: adjustment.type,
      amount_cents: adjustment.amount,
      amount_decimal: formatMoney(adjustment.amount),
      currency: adjustment.currency || '',
      status: adjustment.status || '',
      reason: adjustment.reason || '',
      stripe_refund_id: adjustment.stripeRefundId || '',
      stripe_dispute_id: adjustment.stripeDisputeId || '',
      stripe_charge_id: adjustment.stripeChargeId || '',
      payment_id: payment?.id || '',
      payment_kind: payment?.kind || '',
      payment_paid_at: formatDate(payment?.paidAt),
      payment_amount_cents: payment?.amount ?? '',
      payment_amount_decimal: Number.isFinite(payment?.amount) ? formatMoney(payment.amount) : '',
      payment_currency: payment?.currency || '',
      price_id: payment?.priceId || '',
      stripe_invoice_id: payment?.stripeInvoiceId || '',
      stripe_session_id: payment?.stripeSessionId || '',
      stripe_payment_intent_id: payment?.stripePaymentIntentId || '',
      stripe_customer_id: payment?.stripeCustomerId || '',
      stripe_subscription_id: payment?.stripeSubscriptionId || '',
      billing_legal_name: billingProfile?.legalName || '',
      billing_vat_number: billingProfile?.vatNumber || '',
      billing_vat_country: billingProfile?.vatCountry || '',
      billing_email: billingProfile?.billingEmail || '',
      billing_address_line1: address.line1 || '',
      billing_address_line2: address.line2 || '',
      billing_city: address.city || '',
      billing_state: address.state || '',
      billing_postal_code: address.postalCode || '',
      billing_country: address.country || '',
    };
  });
};

const fetchBillingProfiles = async (ownerIds) => {
  if (!ownerIds.length) {
    return new Map();
  }
  const profiles = await prisma.billingProfile.findMany({
    where: { ownerId: { in: ownerIds } },
  });
  return new Map(profiles.map((profile) => [profile.ownerId, profile]));
};

const fetchInvoices = async (invoiceIds) => {
  if (!invoiceIds.length) {
    return new Map();
  }
  const invoices = await prisma.invoiceRecord.findMany({
    where: { stripeInvoiceId: { in: invoiceIds } },
  });
  return new Map(invoices.map((invoice) => [invoice.stripeInvoiceId, invoice]));
};

const fetchBillingTransactions = async ({ sessionIds, paymentIntentIds }) => {
  if (!sessionIds.length && !paymentIntentIds.length) {
    return [];
  }
  const filters = [];
  if (sessionIds.length) {
    filters.push({ stripeSessionId: { in: sessionIds } });
  }
  if (paymentIntentIds.length) {
    filters.push({ stripePaymentId: { in: paymentIntentIds } });
  }
  return prisma.billingTransaction.findMany({
    where: {
      status: 'paid',
      OR: filters,
    },
  });
};

const fetchPayments = async ({ start, end }) => {
  return prisma.payment.findMany({
    where: {
      paidAt: { gte: start, lt: end },
      status: { in: ['paid', 'refunded'] },
    },
    include: {
      owner: { select: { id: true, email: true, company: true } },
    },
    orderBy: { paidAt: 'asc' },
  });
};

const fetchAdjustments = async ({ start, end }) => {
  return prisma.paymentAdjustment.findMany({
    where: {
      occurredAt: { gte: start, lt: end },
    },
    orderBy: { occurredAt: 'asc' },
  });
};

const generateBillingExports = async ({ start, end }) => {
  const range = normalizeRange({ start, end });
  if (!range) {
    throw new Error('INVALID_EXPORT_RANGE');
  }

  const payments = await fetchPayments(range);
  const adjustments = await fetchAdjustments(range);
  const paymentIds = new Set(payments.map((payment) => payment.id));
  const adjustmentPaymentIds = adjustments
    .map((adjustment) => adjustment.paymentId)
    .filter((id) => Number.isInteger(id));

  const missingPaymentIds = adjustmentPaymentIds.filter((id) => !paymentIds.has(id));
  const extraPayments = missingPaymentIds.length
    ? await prisma.payment.findMany({
      where: { id: { in: missingPaymentIds } },
      include: { owner: { select: { id: true, email: true, company: true } } },
    })
    : [];

  const allPayments = payments.concat(extraPayments);
  const { sessionIds, paymentIntentIds, invoiceIds } = collectPaymentIds(allPayments);
  const ownerIds = new Set([
    ...allPayments.map((payment) => payment.ownerId),
    ...adjustments.map((adjustment) => adjustment.ownerId).filter(Boolean),
  ]);

  const [billingProfiles, invoiceMap, transactions] = await Promise.all([
    fetchBillingProfiles(Array.from(ownerIds)),
    fetchInvoices(invoiceIds),
    fetchBillingTransactions({ sessionIds, paymentIntentIds }),
  ]);

  const { creditsBySession, creditsByPayment } = mapBillingTransactions(transactions);

  const paymentRows = buildPaymentRows({
    payments,
    billingProfiles,
    invoiceMap,
    creditsBySession,
    creditsByPayment,
  });

  const paymentMap = new Map(allPayments.map((payment) => [payment.id, payment]));
  const refundRows = buildRefundRows({ adjustments, billingProfiles, paymentMap });

  const paymentColumns = Object.keys(paymentRows[0] || {
    owner_id: '',
    payment_id: '',
    paid_at: '',
    kind: '',
    amount_cents: '',
    amount_decimal: '',
    currency: '',
    status: '',
    credits_granted: '',
    price_id: '',
    stripe_invoice_id: '',
    stripe_session_id: '',
    stripe_payment_intent_id: '',
    stripe_charge_id: '',
    stripe_customer_id: '',
    stripe_subscription_id: '',
    invoice_number: '',
    invoice_status: '',
    invoice_subtotal_cents: '',
    invoice_subtotal_decimal: '',
    invoice_tax_cents: '',
    invoice_tax_decimal: '',
    invoice_total_cents: '',
    invoice_total_decimal: '',
    invoice_currency: '',
    invoice_issued_at: '',
    billing_legal_name: '',
    billing_vat_number: '',
    billing_vat_country: '',
    billing_tax_status: '',
    billing_tax_exempt: '',
    billing_is_business: '',
    billing_email: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_postal_code: '',
    billing_country: '',
    user_email: '',
    user_company: '',
  });

  const refundColumns = Object.keys(refundRows[0] || {
    owner_id: '',
    adjustment_id: '',
    occurred_at: '',
    type: '',
    amount_cents: '',
    amount_decimal: '',
    currency: '',
    status: '',
    reason: '',
    stripe_refund_id: '',
    stripe_dispute_id: '',
    stripe_charge_id: '',
    payment_id: '',
    payment_kind: '',
    payment_paid_at: '',
    payment_amount_cents: '',
    payment_amount_decimal: '',
    payment_currency: '',
    price_id: '',
    stripe_invoice_id: '',
    stripe_session_id: '',
    stripe_payment_intent_id: '',
    stripe_customer_id: '',
    stripe_subscription_id: '',
    billing_legal_name: '',
    billing_vat_number: '',
    billing_vat_country: '',
    billing_email: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_postal_code: '',
    billing_country: '',
  });

  const paymentsCsv = buildCsv(paymentRows, paymentColumns);
  const refundsCsv = buildCsv(refundRows, refundColumns);

  logger.info({ payments: paymentRows.length, refunds: refundRows.length }, 'Billing export generated');

  return {
    range,
    payments: {
      rows: paymentRows,
      csv: paymentsCsv,
    },
    refunds: {
      rows: refundRows,
      csv: refundsCsv,
    },
  };
};

module.exports = {
  parseDateInput,
  normalizeRange,
  getWeeklyRange,
  generateBillingExports,
};
