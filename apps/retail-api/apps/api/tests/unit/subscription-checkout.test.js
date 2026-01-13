const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = path.resolve(__dirname, '../../src/services/stripe.service.js');

const resetModule = () => {
  delete require.cache[servicePath];
};

test('createSubscriptionCheckoutSession returns checkout session', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_PRICE_ID_SUB_STARTER_EUR = 'price_test_starter_eur';

  resetModule();
  const stripeService = require(servicePath);

  stripeService.stripe.prices = {
    retrieve: async () => ({
      id: 'price_test_starter_eur',
      type: 'recurring',
      recurring: { interval: 'month' },
    }),
  };

  stripeService.stripe.checkout = {
    sessions: {
      create: async (params) => ({
        id: 'sess_test_123',
        url: 'https://stripe.example/checkout',
        params,
      }),
    },
  };

  const session = await stripeService.createSubscriptionCheckoutSession({
    ownerId: 1,
    userEmail: 'owner@example.com',
    planType: 'starter',
    currency: 'EUR',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    stripeCustomerId: 'cus_test_123',
  });

  assert.equal(session.id, 'sess_test_123');
  assert.equal(session.url, 'https://stripe.example/checkout');
  assert.equal(session.params.customer, 'cus_test_123');
});
