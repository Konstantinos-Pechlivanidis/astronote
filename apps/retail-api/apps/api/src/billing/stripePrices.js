const { assertCurrency } = require('./currency');

const CONFIG_ERROR_CODE = 'CONFIG_MISSING_PRICE_ID';

const makeConfigError = (message, meta = {}) => {
  const err = new Error(message);
  err.code = CONFIG_ERROR_CODE;
  Object.assign(err, meta);
  return err;
};

const normalizePackageName = (name) =>
  String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');

const getEnvValue = (key) => {
  const value = process.env[key];
  return value ? String(value).trim() : null;
};

function getCreditTopupPriceId(currency) {
  const normalized = assertCurrency(currency);
  const envKey = `STRIPE_PRICE_ID_CREDIT_TOPUP_${normalized}`;
  const priceId = getEnvValue(envKey);
  if (!priceId) {
    throw makeConfigError(`Missing Stripe price ID for credit topup (${normalized}).`, {
      envKey,
      currency: normalized,
      type: 'credit_topup',
    });
  }
  return priceId;
}

function getSubscriptionPriceId(planType, currency) {
  const normalized = assertCurrency(currency);
  if (!['starter', 'pro'].includes(planType)) {
    const err = new Error(`Invalid plan type: ${planType}`);
    err.code = 'INVALID_PLAN_TYPE';
    throw err;
  }
  const envKey = `STRIPE_PRICE_ID_SUB_${planType.toUpperCase()}_${normalized}`;
  let priceId = getEnvValue(envKey);

  // Backward-compatible alias support (Shopify Billing v2 matrix names):
  // - starter is monthly
  // - pro is yearly
  // This allows environments that set only interval-specific keys to keep working.
  if (!priceId) {
    const impliedInterval = planType === 'starter' ? 'MONTH' : 'YEAR';
    const matrixKey = `STRIPE_PRICE_ID_SUB_${planType.toUpperCase()}_${impliedInterval}_${normalized}`;
    priceId = getEnvValue(matrixKey);
  }

  if (!priceId) {
    throw makeConfigError(`Missing Stripe price ID for ${planType} plan (${normalized}).`, {
      envKey,
      currency: normalized,
      type: 'subscription',
      planType,
    });
  }
  return priceId;
}

function getPackagePriceId(packageName, currency, packageDb = null) {
  const normalized = assertCurrency(currency);

  if (packageDb) {
    if (normalized === 'USD' && packageDb.stripePriceIdUsd) {
      return packageDb.stripePriceIdUsd;
    }
    if (normalized === 'EUR' && packageDb.stripePriceIdEur) {
      return packageDb.stripePriceIdEur;
    }
  }

  const normalizedName = normalizePackageName(packageName);
  if (normalizedName) {
    const envKey = `STRIPE_PRICE_ID_${normalizedName}_${normalized}`;
    const envPriceId = getEnvValue(envKey);
    if (envPriceId) {
      return envPriceId;
    }
  }

  const genericKey = `STRIPE_PRICE_ID_${normalized}`;
  return getEnvValue(genericKey);
}

module.exports = {
  CONFIG_ERROR_CODE,
  getCreditTopupPriceId,
  getSubscriptionPriceId,
  getPackagePriceId,
};
