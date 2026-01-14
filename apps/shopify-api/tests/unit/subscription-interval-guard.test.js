import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Subscription interval guard (simplified plan policy)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('rejects starter=year interval (starter must be month)', async () => {
    const sendError = jest.fn();

    // Mock response helpers before importing controller (ESM)
    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendSuccess: jest.fn(),
      sendError,
    }));

    const { __test } = await import('../../controllers/subscriptions.js');

    const res = {};
    const result = __test.enforceImpliedIntervalOrSendError(res, 'starter', 'year');
    expect(result.ok).toBe(false);
    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      'INVALID_INTERVAL_FOR_PLAN',
      'Invalid interval for plan. starter=month, pro=year',
      expect.any(Object),
    );
  });

  it('accepts pro=year interval and returns resolved interval', async () => {
    const sendError = jest.fn();

    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendSuccess: jest.fn(),
      sendError,
    }));

    const { __test } = await import('../../controllers/subscriptions.js');

    const res = {};
    const result = __test.enforceImpliedIntervalOrSendError(res, 'pro', 'year');
    expect(result.ok).toBe(true);
    expect(result.resolvedInterval).toBe('year');
    expect(sendError).not.toHaveBeenCalled();
  });
});


