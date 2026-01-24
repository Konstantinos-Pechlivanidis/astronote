const pino = require('pino');
const { assertCurrency } = require('./currency');
const logger = pino({ name: 'topup-catalog' });

const TOPUP_DEFS = [
  { amount: 10, priceEnv: 'STRIPE_PRICE_TOPUP_10_EUR', creditsEnv: 'CREDITS_TOPUP_10' },
  { amount: 25, priceEnv: 'STRIPE_PRICE_TOPUP_25_EUR', creditsEnv: 'CREDITS_TOPUP_25' },
  { amount: 50, priceEnv: 'STRIPE_PRICE_TOPUP_50_EUR', creditsEnv: 'CREDITS_TOPUP_50' },
  { amount: 100, priceEnv: 'STRIPE_PRICE_TOPUP_100_EUR', creditsEnv: 'CREDITS_TOPUP_100' },
];

const getEnvValue = (key) => {
  const value = process.env[key];
  return value ? String(value).trim() : null;
};

const parseCredits = (key) => {
  const raw = getEnvValue(key);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const buildTier = (def) => {
  const priceId = getEnvValue(def.priceEnv);
  const credits = parseCredits(def.creditsEnv);
  if (!priceId || !credits) {
    return null;
  }

  return {
    amount: def.amount,
    amountCents: Math.round(def.amount * 100),
    currency: 'EUR',
    priceId,
    credits,
    priceEnv: def.priceEnv,
    creditsEnv: def.creditsEnv,
  };
};

const listTopupTiers = (currency = 'EUR') => {
  const normalized = assertCurrency(currency);
  if (normalized !== 'EUR') {
    const err = new Error(`Top-up tiers are only configured for EUR (requested ${normalized}).`);
    err.code = 'INVALID_CURRENCY';
    throw err;
  }

  return TOPUP_DEFS.map(buildTier).filter(Boolean);
};

const getTopupTierByCredits = (credits, currency = 'EUR') => {
  if (!Number.isInteger(credits) || credits <= 0) {
    return null;
  }

  const tiers = listTopupTiers(currency);
  const tier = tiers.find((entry) => entry.credits === credits) || null;
  if (!tier) {
    logger.warn({ credits, currency }, 'No top-up tier matches requested credits');
  }
  return tier;
};

const getTopupTierByPriceId = (priceId, currency = 'EUR') => {
  if (!priceId) {
    return null;
  }

  const tiers = listTopupTiers(currency);
  const tier = tiers.find((entry) => entry.priceId === priceId) || null;
  if (!tier) {
    logger.warn({ priceId, currency }, 'No top-up tier matches price ID');
  }
  return tier;
};

const buildTopupPriceBreakdown = (tier) => {
  if (!tier) {
    return null;
  }

  return {
    credits: tier.credits,
    currency: tier.currency,
    price: tier.amount,
    vatAmount: 0,
    priceWithVat: tier.amount,
    priceCents: tier.amountCents,
    priceCentsWithVat: tier.amountCents,
    priceEur: tier.currency === 'EUR' ? tier.amount : null,
    priceEurWithVat: tier.currency === 'EUR' ? tier.amount : null,
    priceUsd: null,
    priceUsdWithVat: null,
    taxRate: 0,
    taxTreatment: 'fixed',
  };
};

module.exports = {
  listTopupTiers,
  getTopupTierByCredits,
  getTopupTierByPriceId,
  buildTopupPriceBreakdown,
};
