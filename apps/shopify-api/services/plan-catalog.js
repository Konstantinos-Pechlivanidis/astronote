import { logger } from '../utils/logger.js';

/**
 * Plan Catalog - Single Source of Truth for Subscription Plans
 *
 * Maps planCode + interval + currency -> Stripe priceId
 * All subscription plan mapping logic must use this catalog.
 */

/**
 * Supported plan codes
 */
export const PLAN_CODES = {
  STARTER: 'starter',
  PRO: 'pro',
};

/**
 * Supported billing intervals
 */
export const INTERVALS = {
  MONTH: 'month',
  YEAR: 'year',
};

/**
 * Supported currencies
 */
export const CURRENCIES = {
  EUR: 'EUR',
  USD: 'USD',
};

/**
 * Shopify Subscription SKUs (supported)
 * - starter: month (EUR, USD)
 * - starter: year (EUR, USD)
 * - pro: year (EUR, USD)
 *
 * Notes:
 * - We keep legacy env vars for backward compatibility, but they do NOT enable Starter Yearly.
 */
export const SUPPORTED_SUBSCRIPTION_SKUS = [
  { planCode: 'starter', interval: 'month' },
  { planCode: 'starter', interval: 'year' },
  { planCode: 'pro', interval: 'year' },
];

/**
 * Plan ranking (for upgrade/downgrade logic)
 * Lower number = lower tier
 */
export const PLAN_RANK = {
  starter: 1,
  pro: 2,
  // Add more plans here as needed
};

/**
 * Get plan rank
 * @param {string} planCode - Plan code
 * @returns {number} Plan rank (1 = lowest, higher = better)
 */
export function getPlanRank(planCode) {
  return PLAN_RANK[planCode] || 0;
}

/**
 * Determine if a plan change is an upgrade or downgrade
 * @param {string} currentPlanCode - Current plan code
 * @param {string} targetPlanCode - Target plan code
 * @returns {'upgrade' | 'downgrade' | 'same'} Change type
 */
export function getPlanChangeType(currentPlanCode, targetPlanCode) {
  if (!currentPlanCode || !targetPlanCode) {
    return 'same';
  }
  const currentRank = getPlanRank(currentPlanCode);
  const targetRank = getPlanRank(targetPlanCode);
  if (targetRank > currentRank) {
    return 'upgrade';
  }
  if (targetRank < currentRank) {
    return 'downgrade';
  }
  return 'same';
}

/**
 * Plan Catalog Configuration
 * Maps: planCode + interval + currency -> Stripe priceId env var name
 */
const PLAN_CATALOG_CONFIG = {
  starter: {
    month: {
      EUR: 'STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD',
    },
    year: {
      EUR: 'STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD',
    },
  },
  pro: {
    month: {
      EUR: 'STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_PRO_MONTH_USD',
    },
    year: {
      EUR: 'STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR',
      USD: 'STRIPE_PRICE_ID_SUB_PRO_YEAR_USD',
    },
  },
};

/**
 * Legacy env var names for backward compatibility
 * Maps old format (planCode + currency only) to new format
 */
const LEGACY_ENV_VAR_MAP = {
  starter: {
    EUR: 'STRIPE_PRICE_ID_SUB_STARTER_EUR', // Assumed monthly
    USD: 'STRIPE_PRICE_ID_SUB_STARTER_USD', // Assumed monthly
  },
  pro: {
    EUR: 'STRIPE_PRICE_ID_SUB_PRO_EUR', // Assumed yearly
    USD: 'STRIPE_PRICE_ID_SUB_PRO_USD', // Assumed yearly
  },
};

function flattenMatrixEnvVars() {
  const vars = [];
  for (const intervals of Object.values(PLAN_CATALOG_CONFIG)) {
    for (const currencies of Object.values(intervals)) {
      for (const envVarName of Object.values(currencies)) {
        vars.push(envVarName);
      }
    }
  }
  return vars;
}

function flattenSimplifiedEnvVars() {
  const vars = [];
  for (const currencies of Object.values(LEGACY_ENV_VAR_MAP)) {
    for (const envVarName of Object.values(currencies)) {
      vars.push(envVarName);
    }
  }
  return vars;
}

export function isSupportedSku(planCode, interval) {
  const p = String(planCode || '').toLowerCase();
  const i = String(interval || '').toLowerCase();
  return SUPPORTED_SUBSCRIPTION_SKUS.some((s) => s.planCode === p && s.interval === i);
}

export function listSupportedSkus(currency = null) {
  const normalizedCurrency = currency ? String(currency).toUpperCase() : null;
  const out = [];
  for (const sku of SUPPORTED_SUBSCRIPTION_SKUS) {
    const planCode = sku.planCode;
    const interval = sku.interval;
    for (const cur of Object.values(CURRENCIES)) {
      if (normalizedCurrency && cur !== normalizedCurrency) continue;
      const priceId = getPriceId(planCode, interval, cur);
      if (priceId) {
        out.push({ planCode, interval, currency: cur, priceId });
      }
    }
  }
  return out;
}

/**
 * Get Stripe price ID for a plan
 * @param {string} planCode - 'starter' or 'pro'
 * @param {string} interval - 'month' or 'year'
 * @param {string} currency - 'EUR' or 'USD'
 * @returns {string|null} Stripe price ID or null if not configured
 */
export function getPriceId(planCode, interval, currency = 'EUR') {
  if (!planCode || !interval || !currency) {
    logger.warn('Missing required parameters for getPriceId', {
      planCode,
      interval,
      currency,
    });
    return null;
  }

  const normalizedPlanCode = String(planCode).toLowerCase();
  const normalizedInterval = String(interval).toLowerCase();
  const normalizedCurrency = String(currency).toUpperCase();

  // Validate inputs
  if (!['starter', 'pro'].includes(normalizedPlanCode)) {
    logger.warn('Invalid planCode', { planCode: normalizedPlanCode });
    return null;
  }
  if (!['month', 'year'].includes(normalizedInterval)) {
    logger.warn('Invalid interval', { interval: normalizedInterval });
    return null;
  }
  if (!['EUR', 'USD'].includes(normalizedCurrency)) {
    logger.warn('Invalid currency', { currency: normalizedCurrency });
    return null;
  }

  // Preferred: interval-specific env vars (SKU-driven)
  const envVarName =
    PLAN_CATALOG_CONFIG[normalizedPlanCode]?.[normalizedInterval]?.[normalizedCurrency];
  if (envVarName) {
    const priceId = process.env[envVarName];
    if (priceId) {
      logger.debug('Resolved priceId from matrix catalog', {
        planCode: normalizedPlanCode,
        interval: normalizedInterval,
        currency: normalizedCurrency,
        envVar: envVarName,
        priceId: `${priceId.substring(0, 10)}...`,
      });
      return priceId;
    }
  }

  // Fallback to legacy format for backward compatibility
  // Legacy implies: starter=month, pro=year. It does NOT support starter=year.
  if (
    !(
      (normalizedPlanCode === 'starter' && normalizedInterval === 'month') ||
      (normalizedPlanCode === 'pro' && normalizedInterval === 'year')
    )
  ) {
    return null;
  }
  const legacyEnvVar = LEGACY_ENV_VAR_MAP[normalizedPlanCode]?.[normalizedCurrency];
  if (legacyEnvVar) {
    const priceId = process.env[legacyEnvVar];
    if (priceId) {
      logger.warn('Using legacy priceId mapping (missing interval-specific config)', {
        planCode: normalizedPlanCode,
        interval: normalizedInterval,
        currency: normalizedCurrency,
        legacyEnvVar,
        priceId: `${priceId.substring(0, 10)}...`,
      });
      return priceId;
    }
  }

  logger.error('PriceId not found in catalog', {
    planCode: normalizedPlanCode,
    interval: normalizedInterval,
    currency: normalizedCurrency,
    triedEnvVars: [envVarName, legacyEnvVar].filter(Boolean),
  });

  return null;
}

/**
 * Reverse lookup: Get planCode, interval, currency from Stripe priceId
 * @param {string} priceId - Stripe price ID
 * @returns {Object|null} { planCode, interval, currency } or null if not found
 */
export function resolvePlanFromPriceId(priceId) {
  if (!priceId || typeof priceId !== 'string') {
    return null;
  }

  // Check all combinations in catalog
  for (const [planCode, intervals] of Object.entries(PLAN_CATALOG_CONFIG)) {
    for (const [interval, currencies] of Object.entries(intervals)) {
      for (const [currency, envVarName] of Object.entries(currencies)) {
        const configuredPriceId = process.env[envVarName];
        if (configuredPriceId === priceId) {
          return {
            planCode,
            interval,
            currency,
          };
        }
      }
    }
  }

  // Check legacy format
  for (const [planCode, currencies] of Object.entries(LEGACY_ENV_VAR_MAP)) {
    for (const [currency, envVarName] of Object.entries(currencies)) {
      const configuredPriceId = process.env[envVarName];
      if (configuredPriceId === priceId) {
        // Legacy: starter = monthly, pro = yearly
        const interval = planCode === 'starter' ? 'month' : 'year';
        logger.warn('Resolved plan from legacy priceId (assuming default interval)', {
          priceId: `${priceId.substring(0, 10)}...`,
          planCode,
          interval,
          currency,
        });
        return {
          planCode,
          interval,
          currency,
        };
      }
    }
  }

  logger.warn('Could not resolve plan from priceId', {
    priceId: `${priceId.substring(0, 10)}...`,
  });

  return null;
}

/**
 * Validate that all required price IDs are configured
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateCatalog() {
  // We consider the catalog "valid" if at least the baseline legacy pair exists for both currencies
  // OR if the new supported-SKU vars exist.
  //
  // This prevents breaking existing subscriptions while allowing Starter Yearly where configured.

  const requiredSkuEnvVars = [
    'STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR',
    'STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD',
    'STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR',
    'STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD',
    'STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR',
    'STRIPE_PRICE_ID_SUB_PRO_YEAR_USD',
  ];

  const legacyEnvVars = flattenSimplifiedEnvVars(); // 4 vars: STARTER/PRO × EUR/USD
  const matrixEnvVars = flattenMatrixEnvVars(); // 8 vars: STARTER/PRO × MONTH/YEAR × EUR/USD

  const hasAnyRequiredSku = requiredSkuEnvVars.some((k) => !!process.env[k]);
  const hasAnyLegacy = legacyEnvVars.some((k) => !!process.env[k]);
  const hasAnyMatrix = matrixEnvVars.some((k) => !!process.env[k]);
  const hasFullMatrix = matrixEnvVars.every((k) => !!process.env[k]);

  // Mode selection:
  // - If full matrix is configured, treat as matrix (backward compatible Billing v2 installs).
  // - Else if the supported-SKU vars appear, validate those (Starter month/year + Pro year).
  // - Else validate legacy 4-var set (Starter/Pro by currency only).
  const mode = hasFullMatrix ? 'matrix' : hasAnyRequiredSku ? 'supported_skus' : 'legacy';

  const requiredVars =
    mode === 'supported_skus'
      ? requiredSkuEnvVars
      : mode === 'matrix'
        ? matrixEnvVars
        : legacyEnvVars;

  const missingEnvVars = requiredVars.filter((k) => !process.env[k]);

  return {
    valid: missingEnvVars.length === 0,
    mode,
    missingEnvVars,
    missing: missingEnvVars,
    supportedSkus: listSupportedSkus(),
    hasAnyLegacy,
    hasAnyMatrix,
  };
}

/**
 * Strict validation: require ALL interval-specific env vars (starter/pro × month/year × EUR/USD).
 * This matches Billing v2 expectations where the UI can toggle monthly/yearly and currency.
 *
 * @returns {{ valid: boolean, missingEnvVars: string[] }}
 */
export function validateCatalogStrict() {
  const matrixEnvVars = flattenMatrixEnvVars();
  const missingEnvVars = matrixEnvVars.filter((k) => !process.env[k]);
  return { valid: missingEnvVars.length === 0, missingEnvVars };
}

/**
 * Get all available plans for display
 * @returns {Array} Array of { planCode, interval, currency, priceId, configured: boolean }
 */
export function listAvailablePlans() {
  const plans = [];

  for (const [planCode, intervals] of Object.entries(PLAN_CATALOG_CONFIG)) {
    for (const [interval, currencies] of Object.entries(intervals)) {
      for (const [currency, envVarName] of Object.entries(currencies)) {
        const priceId = process.env[envVarName];
        plans.push({
          planCode,
          interval,
          currency,
          priceId: priceId || null,
          configured: !!priceId,
          envVarName,
        });
      }
    }
  }

  return plans;
}

export default {
  PLAN_CODES,
  INTERVALS,
  CURRENCIES,
  SUPPORTED_SUBSCRIPTION_SKUS,
  isSupportedSku,
  listSupportedSkus,
  getPriceId,
  resolvePlanFromPriceId,
  validateCatalog,
  validateCatalogStrict,
  listAvailablePlans,
};

