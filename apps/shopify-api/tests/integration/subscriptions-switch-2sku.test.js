import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

describe('Subscriptions switch (2-SKU retail-simple mapping)', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.STRIPE_PRICE_ID_SUB_PRO_MONTH_EUR;
    delete process.env.STRIPE_PRICE_ID_SUB_STARTER_YEAR_EUR;
    // Retail-simple required vars (for getPriceId fallback)
    process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_starter_eur';
    process.env.STRIPE_PRICE_ID_SUB_PRO_EUR = 'price_pro_eur';
  });

  async function makeTestAppWithMocks({ currentPlanType, currentInterval }) {
    const mockStripeSync = {
      getSubscriptionStatusWithStripeSync: jest.fn(),
      fetchStripeSubscription: jest.fn(async () => ({ id: 'sub_1' })),
      deriveCanonicalFields: jest.fn(async () => ({ planCode: currentPlanType, interval: currentInterval, currency: 'EUR' })),
      syncDbToStripe: jest.fn(async () => undefined),
    };

    // First call returns "current", second call returns "updated" status (best-effort).
    mockStripeSync.getSubscriptionStatusWithStripeSync
      .mockResolvedValueOnce({
        active: true,
        planCode: currentPlanType,
        planType: currentPlanType,
        interval: currentInterval,
        currency: 'EUR',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: new Date('2030-01-01').toISOString(),
      })
      .mockResolvedValueOnce({
        active: true,
        planCode: currentPlanType,
        planType: currentPlanType,
        interval: currentInterval,
        currency: 'EUR',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: new Date('2030-01-01').toISOString(),
        pendingChange: {
          planCode: 'starter',
          interval: 'month',
          currency: 'EUR',
          effectiveAt: new Date('2030-01-01').toISOString(),
        },
      });

    const switchSubscriptionInterval = jest.fn(async () => {
      throw new Error('switchSubscriptionInterval should not be called in retail-simple mapping');
    });

    const mockStripe = {
      subscriptions: { retrieve: jest.fn(async () => ({ metadata: { planType: currentPlanType } })) },
    };

    const mockStripeService = {
      stripe: mockStripe,
      createSubscriptionChangeCheckoutSession: jest.fn(async () => ({ id: 'cs_1', url: 'https://stripe.example/checkout' })),
      updateSubscription: jest.fn(async () => ({ id: 'sub_1' })),
      scheduleSubscriptionChange: jest.fn(async () => ({ subscription: { id: 'sub_1' } })),
    };

    const mockPrisma = {
      shop: { findUnique: jest.fn(async () => ({ currency: 'EUR' })) },
      subscription: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };

    jest.unstable_mockModule('../../middlewares/store-resolution.js', () => ({
      getStoreId: () => 'shop_1',
    }));
    // Disable schema validation for this integration test (we only care about mapping behavior).
    jest.unstable_mockModule('../../middlewares/validation.js', () => ({
      validateBody: () => (_req, _res, next) => next(),
    }));
    jest.unstable_mockModule('../../services/stripe-sync.js', () => mockStripeSync);
    jest.unstable_mockModule('../../services/stripe.js', () => mockStripeService);
    jest.unstable_mockModule('../../services/subscription.js', () => ({ switchSubscriptionInterval }));
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));

    const router = (await import('../../routes/subscriptions.js')).default;
    const app = express();
    app.use(express.json());
    app.use('/subscriptions', router);

    return { app, mocks: { switchSubscriptionInterval, mockStripeService, mockStripeSync } };
  }

  it('pro/year + {targetPlan:"starter"} schedules downgrade to starter/month (no pro/month lookup)', async () => {
    const { app, mocks } = await makeTestAppWithMocks({ currentPlanType: 'pro', currentInterval: 'year' });

    const res = await request(app)
      .post('/subscriptions/switch')
      .send({ targetPlan: 'starter', currency: 'EUR' })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.scheduled).toBe(true);
    expect(res.body?.data?.planType).toBe('starter');
    expect(res.body?.data?.interval).toBe('month');
    expect(mocks.switchSubscriptionInterval).not.toHaveBeenCalled();
  });

  it('starter/month + {targetPlan:"pro"} returns checkoutUrl for upgrade to pro/year', async () => {
    const { app, mocks } = await makeTestAppWithMocks({ currentPlanType: 'starter', currentInterval: 'month' });

    const res = await request(app)
      .post('/subscriptions/switch')
      .send({ targetPlan: 'pro', currency: 'EUR' })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.changeMode).toBe('checkout');
    expect(res.body?.data?.checkoutUrl).toBeTruthy();
    expect(mocks.switchSubscriptionInterval).not.toHaveBeenCalled();
    expect(mocks.mockStripeService.createSubscriptionChangeCheckoutSession).toHaveBeenCalled();
  });
});


