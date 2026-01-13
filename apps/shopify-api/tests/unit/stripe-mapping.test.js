import { describe, it, expect } from '@jest/globals';
import {
  mapStripeSubscriptionToShopUpdate,
  extractIntervalFromStripeSubscription,
} from '../../services/stripe-mapping.js';

describe('Stripe Subscription Mapping', () => {
  describe('extractIntervalFromStripeSubscription', () => {
    it('extracts interval from items.data[0].price.recurring.interval', () => {
      const stripeSubscription = {
        id: 'sub_123',
        items: {
          data: [
            {
              price: {
                recurring: {
                  interval: 'month',
                },
              },
            },
          ],
        },
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('month');
    });

    it('extracts interval from plan.interval', () => {
      const stripeSubscription = {
        id: 'sub_123',
        plan: {
          interval: 'year',
        },
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('year');
    });

    it('extracts interval from metadata.interval', () => {
      const stripeSubscription = {
        id: 'sub_123',
        metadata: {
          interval: 'month',
        },
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('month');
    });

    it('normalizes interval to lowercase', () => {
      const stripeSubscription = {
        id: 'sub_123',
        items: {
          data: [
            {
              price: {
                recurring: {
                  interval: 'YEAR',
                },
              },
            },
          ],
        },
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('year');
    });

    it('returns "month" as safe default for invalid interval', () => {
      const stripeSubscription = {
        id: 'sub_123',
        items: {
          data: [
            {
              price: {
                recurring: {
                  interval: 'invalid',
                },
              },
            },
          ],
        },
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('month');
    });

    it('returns "month" as safe default when interval not found', () => {
      const stripeSubscription = {
        id: 'sub_123',
      };
      const result = extractIntervalFromStripeSubscription(stripeSubscription);
      expect(result).toBe('month');
    });

    it('returns "month" for null/undefined input', () => {
      expect(extractIntervalFromStripeSubscription(null)).toBe('month');
      expect(extractIntervalFromStripeSubscription(undefined)).toBe('month');
    });
  });

  describe('mapStripeSubscriptionToShopUpdate', () => {
    it('maps Stripe subscription to Shop update data with all fields', () => {
      const stripeSubscription = {
        id: 'sub_123',
        status: 'active',
        items: {
          data: [
            {
              price: {
                recurring: {
                  interval: 'month',
                },
                currency: 'eur',
              },
            },
          ],
        },
        current_period_start: 1609459200, // 2021-01-01
        current_period_end: 1612137600, // 2021-02-01
        cancel_at_period_end: false,
      };

      const result = mapStripeSubscriptionToShopUpdate(stripeSubscription, {
        planCode: 'starter',
        currency: 'EUR',
      });

      expect(result).toEqual({
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus: 'active',
        subscriptionInterval: 'month', // Must be string, never object
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(1609459200 * 1000),
        currentPeriodEnd: new Date(1612137600 * 1000),
        planType: 'starter',
        currency: 'EUR',
      });

      // Verify subscriptionInterval is a string, not an object
      expect(typeof result.subscriptionInterval).toBe('string');
      expect(result.subscriptionInterval).not.toHaveProperty('id');
      expect(result.subscriptionInterval).not.toHaveProperty('items');
    });

    it('never assigns Stripe object to subscriptionInterval', () => {
      const stripeSubscription = {
        id: 'sub_123',
        status: 'active',
        items: {
          data: [
            {
              price: {
                recurring: {
                  interval: 'year',
                },
              },
            },
          ],
        },
      };

      const result = mapStripeSubscriptionToShopUpdate(stripeSubscription);

      // Critical: subscriptionInterval must be a string, never the Stripe object
      expect(typeof result.subscriptionInterval).toBe('string');
      expect(result.subscriptionInterval).toBe('year');
      expect(result.subscriptionInterval).not.toEqual(stripeSubscription);
      expect(result.subscriptionInterval).not.toHaveProperty('id');
    });

    it('handles missing fields gracefully', () => {
      const stripeSubscription = {
        id: 'sub_123',
        status: 'trialing',
      };

      const result = mapStripeSubscriptionToShopUpdate(stripeSubscription);

      expect(result).toEqual({
        stripeSubscriptionId: 'sub_123',
        subscriptionStatus: 'trialing',
        subscriptionInterval: 'month', // Safe default
        cancelAtPeriodEnd: false,
      });
    });

    it('normalizes status correctly', () => {
      expect(
        mapStripeSubscriptionToShopUpdate({ id: 'sub_1', status: 'active' }).subscriptionStatus,
      ).toBe('active');
      expect(
        mapStripeSubscriptionToShopUpdate({ id: 'sub_2', status: 'trialing' }).subscriptionStatus,
      ).toBe('trialing');
      expect(
        mapStripeSubscriptionToShopUpdate({ id: 'sub_3', status: 'canceled' }).subscriptionStatus,
      ).toBe('cancelled');
      expect(
        mapStripeSubscriptionToShopUpdate({ id: 'sub_4', status: 'past_due' }).subscriptionStatus,
      ).toBe('past_due');
    });

    it('handles invalid input safely', () => {
      const result = mapStripeSubscriptionToShopUpdate(null);
      expect(result).toEqual({});
      expect(result.subscriptionInterval).toBeUndefined();
    });
  });
});

