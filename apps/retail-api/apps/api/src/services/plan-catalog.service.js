// apps/api/src/services/plan-catalog.service.js
// Retail billing plan catalog (Shopify parity):
// - Centralize Stripe price-id mapping and reverse lookup
// - Support two catalog modes:
//   - retail-simple: Starter/Month + Pro/Year (per currency)
//   - matrix: planCode × interval × currency
//
// IMPORTANT: This is a pure config/service layer. It must not call Stripe.

const currencyModule = require('../billing/currency');
const SUPPORTED_CURRENCIES = Array.isArray(currencyModule.SUPPORTED_CURRENCIES)
  ? currencyModule.SUPPORTED_CURRENCIES
  : ['EUR', 'USD'];

const PLAN_CODES = ['starter', 'pro'];
const INTERVALS = ['month', 'year'];

const CATALOG_MODES = {
  RETAIL_SIMPLE: 'retail-simple',
  MATRIX: 'matrix',
};

const normalizePlanCode = (planCode) =>
  planCode ? String(planCode).toLowerCase() : null;
const normalizeInterval = (interval) =>
  interval ? String(interval).toLowerCase() : null;
const normalizeCurrency = (currency) =>
  currency ? String(currency).toUpperCase() : null;

// Retail-simple implies: starter=month, pro=year
const isUserSelectableSkuRetailSimple = (planCode, interval) => {
  if (planCode === 'starter' && interval === 'month') {
    return true;
  }
  if (planCode === 'pro' && interval === 'year') {
    return true;
  }
  return false;
};

const env = (key) => {
  const v = process.env[key];
  return v ? String(v).trim() : null;
};

const matrixEnvVar = (planCode, interval, currency) =>
  `STRIPE_PRICE_ID_SUB_${planCode.toUpperCase()}_${interval.toUpperCase()}_${currency}`;
const simpleEnvVar = (planCode, currency) =>
  `STRIPE_PRICE_ID_SUB_${planCode.toUpperCase()}_${currency}`;

function detectCatalogMode() {
  // If ANY matrix var exists, treat config as matrix-mode (and validate strictly there).
  for (const planCode of PLAN_CODES) {
    for (const interval of INTERVALS) {
      for (const currency of SUPPORTED_CURRENCIES) {
        if (env(matrixEnvVar(planCode, interval, currency))) {
          return CATALOG_MODES.MATRIX;
        }
      }
    }
  }
  return CATALOG_MODES.RETAIL_SIMPLE;
}

function listSupportedSkus(currency = null) {
  const mode = detectCatalogMode();
  const out = [];

  const currencies = currency
    ? [normalizeCurrency(currency)]
    : SUPPORTED_CURRENCIES.map(normalizeCurrency);

  for (const c of currencies) {
    if (!c) {
      continue;
    }
    for (const planCode of PLAN_CODES) {
      for (const interval of INTERVALS) {
        // In retail-simple, only expose the two canonical SKUs.
        if (mode === CATALOG_MODES.RETAIL_SIMPLE && !isUserSelectableSkuRetailSimple(planCode, interval)) {
          continue;
        }

        const priceId = getPriceId(planCode, interval, c);
        if (!priceId) {
          continue;
        }

        out.push({ planCode, interval, currency: c, priceId });
      }
    }
  }

  return out;
}

function getPriceId(planCode, interval, currency = 'EUR') {
  const p = normalizePlanCode(planCode);
  const i = normalizeInterval(interval);
  const c = normalizeCurrency(currency) || 'EUR';
  if (!PLAN_CODES.includes(p) || !INTERVALS.includes(i)) {
    return null;
  }
  if (!SUPPORTED_CURRENCIES.includes(c)) {
    return null;
  }

  const mode = detectCatalogMode();

  // Matrix mode: explicit env var for each sku.
  if (mode === CATALOG_MODES.MATRIX) {
    const key = matrixEnvVar(p, i, c);
    return env(key);
  }

  // Retail-simple: legacy env var (implied interval).
  if (!isUserSelectableSkuRetailSimple(p, i)) {
    return null;
  }
  const key = simpleEnvVar(p, c);
  const legacy = env(key);
  if (legacy) {
    return legacy;
  }

  // Backward-compatible alias support: environments that only set matrix keys for implied intervals.
  const impliedInterval = p === 'starter' ? 'month' : 'year';
  const matrixKey = matrixEnvVar(p, impliedInterval, c);
  return env(matrixKey);
}

function resolvePlanFromPriceId(priceId) {
  if (!priceId) {
    return null;
  }
  const needle = String(priceId).trim();
  if (!needle) {
    return null;
  }

  // Search matrix and retail-simple env vars deterministically.
  // (We intentionally do not infer from Stripe API.)
  for (const planCode of PLAN_CODES) {
    for (const interval of INTERVALS) {
      for (const currency of SUPPORTED_CURRENCIES) {
        const matrixKey = matrixEnvVar(planCode, interval, currency);
        const matrixVal = env(matrixKey);
        if (matrixVal && matrixVal === needle) {
          return { planCode, interval, currency };
        }
      }
    }
  }

  // retail-simple (implied intervals)
  for (const planCode of PLAN_CODES) {
    for (const currency of SUPPORTED_CURRENCIES) {
      const legacyKey = simpleEnvVar(planCode, currency);
      const legacyVal = env(legacyKey);
      if (legacyVal && legacyVal === needle) {
        return {
          planCode,
          interval: planCode === 'starter' ? 'month' : 'year',
          currency,
        };
      }

      // alias support: matrix key for implied interval
      const impliedInterval = planCode === 'starter' ? 'month' : 'year';
      const matrixKey = matrixEnvVar(planCode, impliedInterval, currency);
      const matrixVal = env(matrixKey);
      if (matrixVal && matrixVal === needle) {
        return { planCode, interval: impliedInterval, currency };
      }
    }
  }

  return null;
}

function validateCatalog() {
  const mode = detectCatalogMode();
  const requiredVars = [];

  if (mode === CATALOG_MODES.MATRIX) {
    for (const planCode of PLAN_CODES) {
      for (const interval of INTERVALS) {
        for (const currency of SUPPORTED_CURRENCIES) {
          requiredVars.push(matrixEnvVar(planCode, interval, currency));
        }
      }
    }
  } else {
    for (const planCode of PLAN_CODES) {
      for (const currency of SUPPORTED_CURRENCIES) {
        requiredVars.push(simpleEnvVar(planCode, currency));
      }
    }
  }

  const missingVars = requiredVars.filter((k) => !env(k));
  return {
    mode,
    supportedSkus: listSupportedSkus(),
    missingVars,
    valid: missingVars.length === 0,
  };
}

module.exports = {
  PLAN_CODES,
  INTERVALS,
  SUPPORTED_CURRENCIES,
  CATALOG_MODES,
  detectCatalogMode,
  validateCatalog,
  getPriceId,
  resolvePlanFromPriceId,
  listSupportedSkus,
};

