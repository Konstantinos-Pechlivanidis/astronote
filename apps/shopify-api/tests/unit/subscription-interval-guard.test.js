import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Subscription interval guard (SKU-driven plan catalog)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('rejects starter=year when Starter Year SKU is not configured (legacy only)', async () => {
    const sendError = jest.fn();

    // Mock response helpers before importing controller (ESM)
    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendSuccess: jest.fn(),
      sendError,
    }));

    const { __test } = await import('../../controllers/subscriptions.js');

    const res = {};
    // Legacy vars present (Starter implies month only)
    process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_legacy_eur';
    const result = __test.validateSkuOrSendError(res, 'starter', 'year', 'EUR');
    expect(result.ok).toBe(false);
    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      'UNSUPPORTED_PLAN_INTERVAL',
      expect.stringContaining('Unsupported subscription option'),
      expect.any(Object),
    );
  });

  it('accepts starter=year when Starter Year SKU is configured', async () => {
    const sendError = jest.fn();

    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendSuccess: jest.fn(),
      sendError,
    }));

    const { __test } = await import('../../controllers/subscriptions.js');

    const res = {};
    process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR = 'price_starter_year_eur';
    const result = __test.validateSkuOrSendError(res, 'starter', 'year', 'EUR');
    expect(result.ok).toBe(true);
    expect(result.resolvedInterval).toBe('year');
    expect(sendError).not.toHaveBeenCalled();
  });

  it('accepts pro=year interval when Pro Year SKU is configured (or legacy pro)', async () => {
    const sendError = jest.fn();

    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendSuccess: jest.fn(),
      sendError,
    }));

    const { __test } = await import('../../controllers/subscriptions.js');

    const res = {};
    process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_legacy_eur';
    const result = __test.validateSkuOrSendError(res, 'pro', 'year', 'EUR');
    expect(result.ok).toBe(true);
    expect(result.resolvedInterval).toBe('year');
    expect(sendError).not.toHaveBeenCalled();
  });
});


