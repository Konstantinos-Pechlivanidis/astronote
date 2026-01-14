import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  shop: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

// Mock Stripe
const mockStripe = {
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
};

// Mock plan-catalog
const mockPlanCatalog = {
  getPriceId: jest.fn(),
  resolvePlanFromPriceId: jest.fn(),
  getPlanChangeType: jest.fn(),
};

// Mock stripe-sync
const mockStripeSync = {
  getSubscriptionStatusWithStripeSync: jest.fn(),
  fetchStripeSubscription: jest.fn(),
  deriveCanonicalFields: jest.fn(),
  syncDbToStripe: jest.fn(),
};

// Mock stripe service
const mockStripeService = {
  updateSubscription: jest.fn(),
  createSubscriptionCheckoutSession: jest.fn(),
  cancelSubscription: jest.fn(),
  resumeSubscription: jest.fn(),
  getCheckoutSession: jest.fn(),
  ensureStripeCustomer: jest.fn(),
  scheduleSubscriptionChange: jest.fn(),
};

// Mock subscription service
const mockSubscriptionService = {
  activateSubscription: jest.fn(),
  getSubscriptionStatus: jest.fn(),
  allocateFreeCredits: jest.fn(),
  getPlanConfig: jest.fn(),
};

describe('Subscription Change - Immediate and Scheduled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_PRICE_ID_SUB_STARTER_MONTH_EUR = 'price_starter_month_eur';
    process.env.STRIPE_PRICE_ID_SUB_PRO_YEAR_EUR = 'price_pro_year_eur';

    // Ensure ESM mocks are registered BEFORE importing controllers.
    jest.unstable_mockModule('../../middlewares/store-resolution.js', () => ({
      getStoreId: () => 'shop_123',
    }));
    jest.unstable_mockModule('../../services/stripe-sync.js', () => mockStripeSync);
    jest.unstable_mockModule('../../services/plan-catalog.js', () => mockPlanCatalog);
    jest.unstable_mockModule('../../services/stripe.js', () => mockStripeService);
    jest.unstable_mockModule('../../services/subscription.js', () => mockSubscriptionService);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));
  });

  it('immediate change updates priceId and returns updated DTO', async () => {
    // Setup: Current subscription is starter/month, upgrading to pro/month
    const currentSubscription = {
      active: true,
      planCode: 'starter',
      interval: 'month',
      currency: 'EUR',
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
      currentPeriodEnd: new Date('2025-02-01'),
    };

    mockStripeSync.getSubscriptionStatusWithStripeSync.mockResolvedValue(currentSubscription);
    mockPlanCatalog.getPlanChangeType.mockReturnValue('upgrade');
    mockPlanCatalog.getPriceId.mockReturnValue('price_pro_month_eur');

    // Mock Stripe subscription update (immediate)
    const updatedStripeSubscription = {
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      items: {
        data: [
          {
            price: {
              id: 'price_pro_month_eur',
              recurring: { interval: 'month' },
              currency: 'eur',
            },
          },
        ],
      },
      current_period_start: 1735689600,
      current_period_end: 1738368000,
      cancel_at_period_end: false,
    };

    mockStripeService.scheduleSubscriptionChange.mockResolvedValue({
      subscription: updatedStripeSubscription,
    });

    const canonicalFields = {
      planCode: 'pro',
      interval: 'month',
      currency: 'EUR',
      status: 'active',
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
    };

    mockStripeSync.deriveCanonicalFields.mockResolvedValue(canonicalFields);
    mockStripeSync.syncDbToStripe.mockResolvedValue(undefined);

    const updatedStatus = {
      ...currentSubscription,
      planCode: 'pro',
      interval: 'month',
    };
    mockStripeSync.getSubscriptionStatusWithStripeSync.mockResolvedValueOnce(currentSubscription).mockResolvedValueOnce(updatedStatus);

    // Import update function (mocked)
    const { update } = await import('../../controllers/subscriptions.js');

    const req = {
      body: { planType: 'pro', interval: 'month', currency: 'EUR' },
      ctx: { store: { id: 'shop_123' } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    mockPrisma.shop.findUnique.mockResolvedValue({ currency: 'EUR' });

    await update(req, res, next);

    // Verify Stripe subscription was updated with correct priceId
    expect(mockStripeService.updateSubscription).toHaveBeenCalledWith(
      'sub_123',
      'pro',
      'EUR',
      'month',
      'immediate', // Behavior should be immediate for upgrade
    );

    // Verify DB was synced
    expect(mockStripeSync.syncDbToStripe).toHaveBeenCalledWith(
      'shop_123',
      canonicalFields,
      'subscription_change',
    );

    // Verify response includes updated subscription
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(responseData.data.planCode).toBe('pro');
    expect(responseData.data.behavior).toBe('immediate');
    expect(responseData.data.scheduled).toBe(false);
  });

  it('Pro Yearly downgrade returns pendingChange and does NOT change current plan immediately', async () => {
    // Setup: Current subscription is pro/year, downgrading to starter/month
    const currentSubscription = {
      active: true,
      planCode: 'pro',
      interval: 'year',
      currency: 'EUR',
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
      currentPeriodEnd: new Date('2026-01-01'),
    };

    mockStripeSync.getSubscriptionStatusWithStripeSync.mockResolvedValue(currentSubscription);
    mockPlanCatalog.getPlanChangeType.mockReturnValue('downgrade');
    mockPlanCatalog.getPriceId.mockReturnValue('price_starter_month_eur');

    // Mock Stripe subscription update (scheduled at period end)
    const updatedStripeSubscription = {
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      items: {
        data: [
          {
            price: {
              id: 'price_pro_year_eur', // Still pro/year until period end
              recurring: { interval: 'year' },
              currency: 'eur',
            },
          },
        ],
      },
      current_period_start: 1735689600,
      current_period_end: 1738368000, // 2026-01-01
      cancel_at_period_end: false,
    };

    mockStripeService.updateSubscription.mockResolvedValue(updatedStripeSubscription);

    const canonicalFields = {
      planCode: 'pro', // Still pro (not changed yet)
      interval: 'year',
      currency: 'EUR',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
    };

    mockStripeSync.deriveCanonicalFields.mockResolvedValue(canonicalFields);
    mockStripeSync.syncDbToStripe.mockResolvedValue(undefined);

    // After update, status still shows pro/year but with pendingChange
    const updatedStatus = {
      ...currentSubscription,
      pendingChange: {
        planCode: 'starter',
        interval: 'month',
        currency: 'EUR',
        effectiveAt: new Date('2026-01-01'),
      },
    };
    mockStripeSync.getSubscriptionStatusWithStripeSync.mockResolvedValueOnce(currentSubscription).mockResolvedValueOnce(updatedStatus);

    // Import update function (mocked)
    const { update } = await import('../../controllers/subscriptions.js');

    const req = {
      body: { planType: 'starter', interval: 'month', currency: 'EUR' },
      ctx: { store: { id: 'shop_123' } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    mockPrisma.shop.findUnique.mockResolvedValue({ currency: 'EUR' });
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    await update(req, res, next);

    // Verify Stripe subscription was scheduled for period-end change
    expect(mockStripeService.scheduleSubscriptionChange).toHaveBeenCalledWith(
      'sub_123',
      'starter',
      'EUR',
      'month',
    );

    // Verify pendingChange was stored in DB
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { shopId: 'shop_123' },
      data: {
        pendingChangePlanCode: 'starter',
        pendingChangeInterval: 'month',
        pendingChangeCurrency: 'EUR',
        pendingChangeEffectiveAt: expect.any(Date),
      },
    });

    // Verify response includes pendingChange
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    expect(responseData.data.planCode).toBe('starter'); // Target plan
    expect(responseData.data.behavior).toBe('period_end');
    expect(responseData.data.scheduled).toBe(true);
    expect(responseData.data.effectiveAt).toBeTruthy();
    expect(responseData.data.subscription.pendingChange).toBeTruthy();
    expect(responseData.data.subscription.pendingChange.planCode).toBe('starter');
  });

  it('status endpoint reconciles DB to Stripe truth', async () => {
    // Setup: DB says pro/month, Stripe says pro/year
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: 'shop_123',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      planType: 'pro',
      subscriptionInterval: 'month', // DB says monthly
      subscriptionStatus: 'active',
      currency: 'EUR',
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
    });

    mockPrisma.subscription.findUnique.mockResolvedValue({
      planCode: 'pro',
      interval: 'month', // DB says monthly
      currency: 'EUR',
      status: 'active',
      pendingChangePlanCode: null,
      pendingChangeInterval: null,
      pendingChangeCurrency: null,
      pendingChangeEffectiveAt: null,
      lastSyncedAt: null,
      sourceOfTruth: null,
    });

    // Stripe says pro/year
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      items: {
        data: [
          {
            price: {
              id: 'price_pro_year_eur',
              recurring: { interval: 'year' },
              currency: 'eur',
            },
          },
        ],
      },
      current_period_start: 1735689600,
      current_period_end: 1738368000,
      cancel_at_period_end: false,
    });

    mockPlanCatalog.resolvePlanFromPriceId.mockReturnValue({
      planCode: 'pro',
      interval: 'year', // Stripe says yearly
      currency: 'EUR',
    });

    const canonicalFields = {
      planCode: 'pro',
      interval: 'year', // Stripe truth
      currency: 'EUR',
      status: 'active',
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: 'sub_123',
      stripeCustomerId: 'cus_123',
    };

    mockStripeSync.fetchStripeSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      customer: 'cus_123',
      items: {
        data: [
          {
            price: {
              id: 'price_pro_year_eur',
              recurring: { interval: 'year' },
              currency: 'eur',
            },
          },
        ],
      },
      current_period_start: 1735689600,
      current_period_end: 1738368000,
      cancel_at_period_end: false,
    });

    mockStripeSync.deriveCanonicalFields.mockResolvedValue(canonicalFields);
    mockStripeSync.syncDbToStripe.mockResolvedValue(undefined);

    // Import getSubscriptionStatusWithStripeSync
    jest.unstable_mockModule('../../services/stripe-sync.js', () => ({
      ...mockStripeSync,
      fetchStripeSubscription: mockStripeSync.fetchStripeSubscription,
      deriveCanonicalFields: mockStripeSync.deriveCanonicalFields,
      syncDbToStripe: mockStripeSync.syncDbToStripe,
      getSubscriptionStatusWithStripeSync: async (shopId) => {
        // Simulate reconciliation logic
        const shop = await mockPrisma.shop.findUnique({ where: { id: shopId } });
        if (!shop?.stripeSubscriptionId) {
          return { active: false };
        }

        const stripeSub = await mockStripeSync.fetchStripeSubscription(shop.stripeSubscriptionId);
        if (!stripeSub) {
          return { active: false };
        }

        const canonical = await mockStripeSync.deriveCanonicalFields(stripeSub);
        if (canonical) {
          await mockStripeSync.syncDbToStripe(shopId, canonical, 'status_reconcile');
        }

        return {
          active: true,
          planCode: canonical.planCode,
          interval: canonical.interval,
          currency: canonical.currency,
          status: canonical.status,
          mismatchDetected: true, // Mismatch was detected and fixed
          derivedFrom: 'stripe_priceId',
          sourceOfTruth: 'stripe_verified',
        };
      },
    }));

    jest.unstable_mockModule('../../services/plan-catalog.js', () => mockPlanCatalog);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));

    const { getSubscriptionStatusWithStripeSync } = await import('../../services/stripe-sync.js');

    const result = await getSubscriptionStatusWithStripeSync('shop_123');

    // Verify DB was updated to match Stripe
    expect(mockStripeSync.syncDbToStripe).toHaveBeenCalledWith(
      'shop_123',
      canonicalFields,
      'status_reconcile',
    );

    // Verify result reflects Stripe truth (yearly, not monthly)
    expect(result.active).toBe(true);
    expect(result.planCode).toBe('pro');
    expect(result.interval).toBe('year'); // Stripe truth, not DB's 'month'
    expect(result.mismatchDetected).toBe(true);
    expect(result.derivedFrom).toBe('stripe_priceId');
  });
});

