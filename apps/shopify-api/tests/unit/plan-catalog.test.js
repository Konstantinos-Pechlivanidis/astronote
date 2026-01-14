import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getPriceId,
  resolvePlanFromPriceId,
  validateCatalog,
  PLAN_CODES,
  INTERVALS,
  CURRENCIES,
} from '../../services/plan-catalog.js';

describe('Plan Catalog', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getPriceId', () => {
    it('resolves priceId for starter month EUR', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_starter_month_eur';
      const result = getPriceId('starter', 'month', 'EUR');
      expect(result).toBe('price_starter_month_eur');
    });

    it('resolves priceId for starter year EUR', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR = 'price_starter_year_eur';
      const result = getPriceId('starter', 'year', 'EUR');
      expect(result).toBe('price_starter_year_eur');
    });

    it('resolves priceId for pro month USD', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_USD = 'price_pro_month_usd';
      const result = getPriceId('pro', 'month', 'USD');
      expect(result).toBe('price_pro_month_usd');
    });

    it('resolves priceId for pro year USD', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_USD = 'price_pro_year_usd';
      const result = getPriceId('pro', 'year', 'USD');
      expect(result).toBe('price_pro_year_usd');
    });

    it('falls back to legacy format for starter EUR (assumed monthly)', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_legacy_eur';
      const result = getPriceId('starter', 'month', 'EUR');
      expect(result).toBe('price_starter_legacy_eur');
    });

    it('falls back to legacy format for pro EUR (assumed yearly)', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_legacy_eur';
      const result = getPriceId('pro', 'year', 'EUR');
      expect(result).toBe('price_pro_legacy_eur');
    });

    it('returns null for invalid planCode', () => {
      const result = getPriceId('invalid', 'month', 'EUR');
      expect(result).toBeNull();
    });

    it('returns null for invalid interval', () => {
      const result = getPriceId('starter', 'invalid', 'EUR');
      expect(result).toBeNull();
    });

    it('returns null for invalid currency', () => {
      const result = getPriceId('starter', 'month', 'INVALID');
      expect(result).toBeNull();
    });

    it('returns null when priceId not configured', () => {
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR;
      const result = getPriceId('starter', 'month', 'EUR');
      expect(result).toBeNull();
    });

    it('handles case-insensitive inputs', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_starter_month_eur';
      expect(getPriceId('STARTER', 'MONTH', 'eur')).toBe('price_starter_month_eur');
      expect(getPriceId('starter', 'Month', 'EUR')).toBe('price_starter_month_eur');
    });
  });

  describe('resolvePlanFromPriceId', () => {
    it('resolves planCode, interval, currency from priceId', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_starter_month_eur';
      const result = resolvePlanFromPriceId('price_starter_month_eur');
      expect(result).toEqual({
        planCode: 'starter',
        interval: 'month',
        currency: 'EUR',
      });
    });

    it('resolves pro year USD from priceId', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_USD = 'price_pro_year_usd';
      const result = resolvePlanFromPriceId('price_pro_year_usd');
      expect(result).toEqual({
        planCode: 'pro',
        interval: 'year',
        currency: 'USD',
      });
    });

    it('resolves from legacy format (starter assumed monthly)', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_legacy_eur';
      const result = resolvePlanFromPriceId('price_starter_legacy_eur');
      expect(result).toEqual({
        planCode: 'starter',
        interval: 'month',
        currency: 'EUR',
      });
    });

    it('resolves from legacy format (pro assumed yearly)', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_legacy_eur';
      const result = resolvePlanFromPriceId('price_pro_legacy_eur');
      expect(result).toEqual({
        planCode: 'pro',
        interval: 'year',
        currency: 'EUR',
      });
    });

    it('returns null for unknown priceId', () => {
      const result = resolvePlanFromPriceId('price_unknown');
      expect(result).toBeNull();
    });

    it('returns null for null/undefined priceId', () => {
      expect(resolvePlanFromPriceId(null)).toBeNull();
      expect(resolvePlanFromPriceId(undefined)).toBeNull();
      expect(resolvePlanFromPriceId('')).toBeNull();
    });
  });

  describe('validateCatalog', () => {
    it('returns valid in simplified mode when the 4 Retail-parity vars are configured', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_eur';
      process.env.STRIPE_PRICE_ID_SUB_STARTER_USD = 'price_starter_usd';
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur';
      process.env.STRIPE_PRICE_ID_SUB_PRO_USD = 'price_pro_usd';

      const result = validateCatalog();
      expect(result.valid).toBe(true);
      expect(result.mode).toBe('simplified');
      expect(result.missing).toHaveLength(0);
    });

    it('returns invalid in simplified mode if any one of the 4 vars is missing', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_eur';
      process.env.STRIPE_PRICE_ID_SUB_STARTER_USD = 'price_starter_usd';
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur';
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_USD;

      const result = validateCatalog();
      expect(result.valid).toBe(false);
      expect(result.mode).toBe('simplified');
      expect(result.missingEnvVars).toContain('STRIPE_PRICE_ID_SUB_PRO_USD');
    });

    it('returns valid when all priceIds are configured', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_1';
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD = 'price_2';
      process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR = 'price_3';
      process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD = 'price_4';
      process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR = 'price_5';
      process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_USD = 'price_6';
      process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR = 'price_7';
      process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_USD = 'price_8';

      const result = validateCatalog();
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.mode).toBe('matrix');
    });

    it('returns missing when some priceIds are not configured', () => {
      // Only set one priceId, leave others missing
      process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_1';
      // Clear other env vars to ensure they're missing
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_USD;
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_USD;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_USD;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_USD;
      // Also clear legacy
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_STARTER_USD;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_EUR;
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_USD;

      const result = validateCatalog();
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      // Should contain at least one missing mapping (not starter/month/EUR since we set it)
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  describe('Constants', () => {
    it('exports PLAN_CODES constants', () => {
      expect(PLAN_CODES.STARTER).toBe('starter');
      expect(PLAN_CODES.PRO).toBe('pro');
    });

    it('exports INTERVALS constants', () => {
      expect(INTERVALS.MONTH).toBe('month');
      expect(INTERVALS.YEAR).toBe('year');
    });

    it('exports CURRENCIES constants', () => {
      expect(CURRENCIES.EUR).toBe('EUR');
      expect(CURRENCIES.USD).toBe('USD');
    });
  });
});

