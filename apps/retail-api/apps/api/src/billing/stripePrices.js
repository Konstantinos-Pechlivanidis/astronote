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
  const normalizedPlan = String(planType || '').toLowerCase();
  if (!['starter', 'pro'].includes(normalizedPlan)) {
    const err = new Error(`Invalid plan type: ${planType}`);
    err.code = 'INVALID_PLAN_TYPE';
    throw err;
  }

  // Prefer centralized plan catalog (Shopify parity).
  // This also ensures matrix mode (plan×interval×currency) is supported when configured.
  const planCatalog = require('../services/plan-catalog.service');
  const impliedInterval = normalizedPlan === 'starter' ? 'month' : 'year';
  const priceId = planCatalog.getPriceId(normalizedPlan, impliedInterval, normalized);
  if (priceId) {
    return priceId;
  }

  // Fallback to legacy direct env var lookup for robustness (keeps current behavior if module resolution differs).
  const envKey = `STRIPE_PRICE_ID_SUB_${normalizedPlan.toUpperCase()}_${normalized}`;
  const legacy = getEnvValue(envKey);
  if (legacy) {
    return legacy;
  }

  throw makeConfigError(
    `Missing Stripe price ID for ${normalizedPlan} plan (${normalized}).`,
    {
      envKey,
      currency: normalized,
      type: 'subscription',
      planType: normalizedPlan,
    },
  );
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
