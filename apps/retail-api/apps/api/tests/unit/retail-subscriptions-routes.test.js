const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('path');

function withStubbedRequire(resolvers, fn) {
  const originals = [];
  for (const [resolvedPath, exports] of resolvers) {
    const resolved = require.resolve(resolvedPath);
    originals.push([resolved, require.cache[resolved]]);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [resolved, original] of originals) {
        if (original) {
          require.cache[resolved] = original;
        } else {
          delete require.cache[resolved];
        }
      }
    });
}

async function startAppWithBillingRouter() {
  const billingRoutesPath = path.resolve(__dirname, '../../src/routes/billing.js');
  delete require.cache[billingRoutesPath];
  const billingRouter = require(billingRoutesPath);
  const app = express();
  app.use(express.json());
  app.use('/api', billingRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return { server, baseUrl };
}

test('POST /api/subscriptions/subscribe returns checkoutUrl (EUR)', async () => {
  process.env.FRONTEND_URL = 'https://example.com';

  const requireAuthPath = path.resolve(__dirname, '../../src/middleware/requireAuth.js');
  const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
  const subscriptionServicePath = path.resolve(__dirname, '../../src/services/subscription.service.js');
  const billingProfileServicePath = path.resolve(__dirname, '../../src/services/billing-profile.service.js');
  const currencyPath = path.resolve(__dirname, '../../src/billing/currency.js');
  const stripeServicePath = path.resolve(__dirname, '../../src/services/stripe.service.js');

  await withStubbedRequire(
    [
      [
        requireAuthPath,
        (req, _res, next) => {
          req.user = { id: 123, email: 'u@example.com', company: 'Co' };
          next();
        },
      ],
      [
        prismaPath,
        {
          user: { update: async () => ({}) },
        },
      ],
      [
        subscriptionServicePath,
        {
          getSubscriptionStatus: async () => ({ active: false, stripeCustomerId: null }),
        },
      ],
      [
        billingProfileServicePath,
        { getBillingProfile: async () => null, upsertBillingProfile: async () => ({}) },
      ],
      [
        currencyPath,
        {
          resolveBillingCurrency: async ({ currency }) => currency || 'EUR',
        },
      ],
      [
        stripeServicePath,
        {
          stripe: { subscriptions: { retrieve: async () => ({}) } },
          ensureStripeCustomer: async () => 'cus_test_1',
          createSubscriptionCheckoutSession: async () => ({
            id: 'cs_test_1',
            url: 'https://stripe.example/checkout',
          }),
        },
      ],
    ],
    async () => {
      const { server, baseUrl } = await startAppWithBillingRouter();
      try {
        const res = await fetch(`${baseUrl}/api/subscriptions/subscribe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            planType: 'starter',
            currency: 'EUR',
          }),
        });

        assert.equal(res.status, 201);
        const json = await res.json();
        assert.equal(json.ok, true);
        assert.equal(json.checkoutUrl, 'https://stripe.example/checkout');
        assert.equal(json.planType, 'starter');
        assert.equal(json.currency, 'EUR');
      } finally {
        await new Promise((r) => server.close(r));
      }
    },
  );
});

test('POST /api/subscriptions/switch maps interval->planType (month->starter, year->pro)', async () => {
  process.env.FRONTEND_URL = 'https://example.com';

  const requireAuthPath = path.resolve(__dirname, '../../src/middleware/requireAuth.js');
  const subscriptionServicePath = path.resolve(__dirname, '../../src/services/subscription.service.js');
  const stripeSyncServicePath = path.resolve(__dirname, '../../src/services/stripe-sync.service.js');
  const billingProfileServicePath = path.resolve(__dirname, '../../src/services/billing-profile.service.js');
  const currencyPath = path.resolve(__dirname, '../../src/billing/currency.js');
  const stripeServicePath = path.resolve(__dirname, '../../src/services/stripe.service.js');

  let updatedTo = null;
  await withStubbedRequire(
    [
      [
        requireAuthPath,
        (req, _res, next) => {
          req.user = { id: 123, email: 'u@example.com', company: 'Co' };
          next();
        },
      ],
      [
        subscriptionServicePath,
        {
          getIntervalForPlan: (planType) => (planType === 'starter' ? 'month' : 'year'),
          activateSubscription: async (_ownerId, _cusId, _subId, planType, meta) => {
            updatedTo = { planType, interval: meta?.interval };
            return {};
          },
        },
      ],
      [
        stripeSyncServicePath,
        {
          getSubscriptionStatusWithStripeSync: async () => ({
            active: true,
            planType: 'starter',
            interval: 'month',
            stripeSubscriptionId: 'sub_test_1',
            stripeCustomerId: 'cus_test_1',
            pendingChange: null,
          }),
        },
      ],
      [
        billingProfileServicePath,
        { getBillingProfile: async () => null, upsertBillingProfile: async () => ({}) },
      ],
      [
        currencyPath,
        {
          resolveBillingCurrency: async ({ currency }) => currency || 'EUR',
        },
      ],
      [
        stripeServicePath,
        {
          stripe: { subscriptions: { retrieve: async () => ({}) } },
          ensureStripeCustomer: async () => 'cus_test_1',
          createSubscriptionChangeCheckoutSession: async () => ({
            id: 'cs_change_1',
            url: 'https://stripe.example/checkout-change',
          }),
        },
      ],
    ],
    async () => {
      const { server, baseUrl } = await startAppWithBillingRouter();
      try {
        const res = await fetch(`${baseUrl}/api/subscriptions/switch`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ interval: 'year', currency: 'EUR' }),
        });

        const json = await res.json().catch(() => null);
        assert.equal(res.status, 200, `Expected 200, got ${res.status}. Body: ${JSON.stringify(json)}`);
        assert.equal(json.ok, true);
        assert.equal(json.planType, 'pro');
        assert.equal(json.interval, 'year');
        assert.equal(json.changeMode, 'checkout');
        assert.equal(json.checkoutUrl, 'https://stripe.example/checkout-change');
        assert.equal(updatedTo, null);
      } finally {
        await new Promise((r) => server.close(r));
      }
    },
  );
});


