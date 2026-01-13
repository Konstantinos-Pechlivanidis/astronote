import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getStripeSubscriptionPriceId } from '../../services/stripe.js';

describe('Stripe Subscription Price ID Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getStripeSubscriptionPriceId', () => {
    it('should resolve pro plan USD price ID', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_USD = 'price_pro_usd_123';
      const result = getStripeSubscriptionPriceId('pro', 'USD');
      expect(result).toBe('price_pro_usd_123');
    });

    it('should resolve pro plan EUR price ID', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur_456';
      const result = getStripeSubscriptionPriceId('pro', 'EUR');
      expect(result).toBe('price_pro_eur_456');
    });

    it('should resolve starter plan USD price ID', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_USD = 'price_starter_usd_789';
      const result = getStripeSubscriptionPriceId('starter', 'USD');
      expect(result).toBe('price_starter_usd_789');
    });

    it('should resolve starter plan EUR price ID', () => {
      process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_eur_012';
      const result = getStripeSubscriptionPriceId('starter', 'EUR');
      expect(result).toBe('price_starter_eur_012');
    });

    it('should handle case-insensitive currency', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur_456';
      expect(getStripeSubscriptionPriceId('pro', 'eur')).toBe(
        'price_pro_eur_456',
      );
      expect(getStripeSubscriptionPriceId('pro', 'Eur')).toBe(
        'price_pro_eur_456',
      );
    });

    it('should handle case-insensitive plan type', () => {
      process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur_456';
      expect(getStripeSubscriptionPriceId('PRO', 'EUR')).toBe(
        'price_pro_eur_456',
      );
    });

    it('should return null for missing price ID', () => {
      delete process.env.STRIPE_PRICE_ID_SUB_PRO_USD;
      const result = getStripeSubscriptionPriceId('pro', 'USD');
      expect(result).toBeNull();
    });

    it('should return null for invalid plan type', () => {
      const result = getStripeSubscriptionPriceId('invalid', 'EUR');
      expect(result).toBeNull();
    });
  });
});

