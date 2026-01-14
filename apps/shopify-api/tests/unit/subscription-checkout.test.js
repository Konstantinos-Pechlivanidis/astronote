import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const stripeMock = {
  createSubscriptionCheckoutSession: jest.fn(),
  updateSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  resumeSubscription: jest.fn(),
  getCheckoutSession: jest.fn(),
  ensureStripeCustomer: jest.fn(),
};

const subscriptionMock = {
  getSubscriptionStatus: jest.fn(),
  activateSubscription: jest.fn(),
  deactivateSubscription: jest.fn(),
  allocateFreeCredits: jest.fn(),
  getPlanConfig: jest.fn(),
  reconcileSubscriptionFromStripe: jest.fn(),
};

const billingProfileMock = {
  getBillingProfile: jest.fn(),
  validateBillingProfileForCheckout: jest.fn(),
  syncBillingProfileFromStripe: jest.fn(),
  upsertBillingProfile: jest.fn(),
};

const prismaMock = {
  shop: {
    findUnique: jest.fn(),
  },
};

let subscribe;

describe('Subscription checkout controller', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env.FRONTEND_URL = 'https://example.com';
    jest.unstable_mockModule('../../services/stripe.js', () => stripeMock);
    jest.unstable_mockModule('../../services/subscription.js', () => subscriptionMock);
    jest.unstable_mockModule('../../services/billing-profile.js', () => billingProfileMock);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    ({ subscribe } = await import('../../controllers/subscriptions.js'));
  });

  it('returns a checkout URL and session ID', async () => {
    subscriptionMock.getSubscriptionStatus.mockResolvedValue({ active: false, planType: null });
    billingProfileMock.getBillingProfile.mockResolvedValue({
      billingEmail: 'test@example.com',
      legalName: 'Test Shop',
      billingAddress: { line1: '123 Main St', country: 'US' },
    });
    billingProfileMock.validateBillingProfileForCheckout.mockReturnValue({ valid: true, missingFields: [] });
    stripeMock.ensureStripeCustomer.mockResolvedValue('cus_test_123');
    prismaMock.shop.findUnique.mockResolvedValue({ currency: 'EUR' });
    stripeMock.createSubscriptionCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.example.com/session',
    });

    const req = {
      body: { planType: 'starter' },
      ctx: {
        store: {
          id: 'shop_123',
          shopDomain: 'test-shop.myshopify.com',
          shopName: 'Test Shop',
          currency: 'EUR',
        },
      },
      headers: {},
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await subscribe(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data.checkoutUrl).toBe('https://checkout.example.com/session');
    expect(response.data.sessionId).toBe('cs_test_123');
  });
});
