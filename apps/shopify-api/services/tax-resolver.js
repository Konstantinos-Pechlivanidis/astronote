import { logger } from '../utils/logger.js';

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
]);

const DEFAULT_EU_VAT_RATE = Number.parseFloat(
  process.env.VAT_RATE_EU_DEFAULT || '0.20',
);

const DEFAULT_VAT_RATES = {
  GR: 0.24,
  AT: 0.20,
  BE: 0.21,
  BG: 0.20,
  HR: 0.25,
  CY: 0.19,
  CZ: 0.21,
  DK: 0.25,
  EE: 0.22,
  FI: 0.24,
  FR: 0.20,
  DE: 0.19,
  HU: 0.27,
  IE: 0.23,
  IT: 0.22,
  LV: 0.21,
  LT: 0.21,
  LU: 0.17,
  MT: 0.18,
  NL: 0.21,
  PL: 0.23,
  PT: 0.23,
  RO: 0.19,
  SK: 0.20,
  SI: 0.22,
  ES: 0.21,
  SE: 0.25,
};

const normalizeCountryCode = (value) => {
  if (!value) return null;
  const code = String(value).trim().toUpperCase();
  if (!code) return null;
  if (code === 'EL') return 'GR';
  return code;
};

const resolveVatRate = (countryCode) => {
  const code = normalizeCountryCode(countryCode);
  if (!code) return null;
  const envRate = process.env[`VAT_RATE_${code}`];
  if (envRate) {
    const parsed = Number.parseFloat(envRate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (DEFAULT_VAT_RATES[code] !== undefined) {
    return DEFAULT_VAT_RATES[code];
  }
  return DEFAULT_EU_VAT_RATE;
};

const isEuCountry = (countryCode) => {
  const code = normalizeCountryCode(countryCode);
  return code ? EU_COUNTRIES.has(code) : false;
};

export function resolveTaxTreatment({
  billingCountry,
  ipCountry,
  vatId,
  vatIdValidated,
  isBusiness = null,
} = {}) {
  const normalizedBilling = normalizeCountryCode(billingCountry);
  const normalizedIp = normalizeCountryCode(ipCountry);
  const country = normalizedBilling || normalizedIp;
  const vatProvided = Boolean(vatId);
  const vatVerified = vatIdValidated === true;
  const business = isBusiness !== null ? isBusiness : vatProvided;

  if (!country) {
    logger.warn('Tax resolver missing country', {
      billingCountry,
      ipCountry,
    });
    return {
      mode: 'unknown',
      taxRate: null,
      taxJurisdiction: null,
      collectTaxId: true,
      country: null,
      notes: 'missing_country',
    };
  }

  if (!isEuCountry(country)) {
    return {
      mode: 'non_eu',
      taxRate: 0,
      taxJurisdiction: country,
      collectTaxId: false,
      country,
      notes: 'non_eu',
    };
  }

  if (country === 'GR') {
    const rate = resolveVatRate(country);
    return {
      mode: 'domestic_vat',
      taxRate: rate,
      taxJurisdiction: country,
      collectTaxId: true,
      country,
      notes: business && vatVerified ? 'gr_domestic_b2b' : 'gr_domestic_b2c',
    };
  }

  if (business && vatProvided && vatVerified) {
    return {
      mode: 'eu_reverse_charge',
      taxRate: 0,
      taxJurisdiction: country,
      collectTaxId: true,
      country,
      notes: 'eu_b2b_reverse_charge',
    };
  }

  const rate = resolveVatRate(country);
  return {
    mode: 'eu_b2c',
    taxRate: rate,
    taxJurisdiction: country,
    collectTaxId: true,
    country,
    notes: 'eu_b2c',
  };
}

export function resolveTaxRateForInvoice({ subtotal, tax }) {
  if (!subtotal || subtotal <= 0 || tax === null || tax === undefined) {
    return null;
  }
  const rate = tax / subtotal;
  return Number.isFinite(rate) ? rate : null;
}

export function buildTaxEvidenceInput({
  shopId,
  billingCountry,
  ipCountry,
  vatId,
  vatIdValidated,
  taxTreatment,
  taxRateApplied,
  taxJurisdiction,
}) {
  return {
    shopId,
    billingCountry: normalizeCountryCode(billingCountry),
    ipCountry: normalizeCountryCode(ipCountry),
    vatIdProvided: vatId || null,
    vatIdValidated: vatIdValidated === true ? true : vatIdValidated === false ? false : null,
    taxTreatment: taxTreatment || null,
    taxRateApplied: Number.isFinite(taxRateApplied) ? taxRateApplied : null,
    taxJurisdiction: taxJurisdiction || null,
  };
}

export default {
  resolveTaxTreatment,
  resolveTaxRateForInvoice,
  buildTaxEvidenceInput,
};
