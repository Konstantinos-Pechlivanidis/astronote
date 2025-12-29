import { describe, it, expect } from 'vitest';
import { normalizeBalanceResponse } from '../../../api/modules/billing';

/**
 * Test normalization functions for billing API responses
 * These are pure functions, so easy to unit test
 */

describe('normalizeBalanceResponse', () => {
  it('converts balance number to credits field', () => {
    const input = {
      balance: 100,
      subscription: { active: true, planType: 'starter' },
    };
    const result = normalizeBalanceResponse(input);
    expect(result).toEqual({
      credits: 100,
      subscription: { active: true, planType: 'starter' },
    });
  });

  it('handles null balance', () => {
    const input = {
      balance: null,
      subscription: { active: false },
    };
    const result = normalizeBalanceResponse(input);
    expect(result).toEqual({
      credits: 0,
      subscription: { active: false },
    });
  });

  it('handles undefined balance', () => {
    const input = {
      subscription: { active: false },
    };
    const result = normalizeBalanceResponse(input);
    expect(result).toEqual({
      credits: 0,
      subscription: { active: false },
    });
  });

  it('handles null input gracefully', () => {
    const result = normalizeBalanceResponse(null);
    expect(result).toBeNull();
  });

  it('handles undefined input gracefully', () => {
    const result = normalizeBalanceResponse(undefined);
    expect(result).toBeNull();
  });

  it('preserves subscription object', () => {
    const input = {
      balance: 50,
      subscription: {
        active: true,
        planType: 'pro',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_456',
      },
    };
    const result = normalizeBalanceResponse(input);
    expect(result.subscription).toEqual(input.subscription);
    expect(result.credits).toBe(50);
  });

  it('defaults subscription if missing', () => {
    const input = {
      balance: 200,
    };
    const result = normalizeBalanceResponse(input);
    expect(result).toEqual({
      credits: 200,
      subscription: { active: false, planType: null },
    });
  });
});

