const prisma = require('../lib/prisma');

const SUPPORTED_CURRENCIES = ['EUR', 'USD'];

const normalizeCurrency = (value) => {
  if (!value) {
    return null;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(normalized)) {
    return null;
  }
  return normalized;
};

const assertCurrency = (value) => {
  const normalized = normalizeCurrency(value);
  if (!normalized) {
    const err = new Error(`Unsupported currency: ${value}`);
    err.code = 'INVALID_CURRENCY';
    throw err;
  }
  return normalized;
};

async function resolveBillingCurrency({ userId, currency }) {
  const requested = normalizeCurrency(currency);
  if (requested) {
    return requested;
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { billingCurrency: true },
    });
    const stored = normalizeCurrency(user?.billingCurrency);
    if (stored) {
      return stored;
    }
  }

  return 'EUR';
}

module.exports = {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
  assertCurrency,
  resolveBillingCurrency,
};
