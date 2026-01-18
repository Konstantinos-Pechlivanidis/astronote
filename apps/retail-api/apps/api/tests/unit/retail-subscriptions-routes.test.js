const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const METHODS = { POST: 'post', GET: 'get' };

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

function getRouteHandlers(pathname, method) {
  const billingRoutesPath = path.resolve(__dirname, '../../src/routes/billing.js');
  delete require.cache[billingRoutesPath];
  const billingRouter = require(billingRoutesPath);
  const methodKey = METHODS[method.toUpperCase()];
  const layer = billingRouter.stack.find(
    (l) => l.route && l.route.path === pathname && l.route.methods[methodKey],
  );
  if (!layer) {
    throw new Error(`Route not found for ${method} ${pathname}`);
  }
  return layer.route.stack.map((s) => s.handle);
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    set(field, value) {
      this.headers[String(field).toLowerCase()] = value;
      return this;
    },
    end(payload) {
      if (payload !== undefined) {
        this.body = payload;
      }
      this.finished = true;
      return this;
    },
  };
}

async function invokeBillingRoute(pathname, method, { body, query, headers, user } = {}) {
  const handlers = getRouteHandlers(pathname, method);
  const req = {
    body: body || {},
    query: query || {},
    headers: Object.fromEntries(
      Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    user: user || {},
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
  };
  const res = createMockRes();
  const next = (err) => {
    if (err) {
      throw err;
    }
  };

  for (const handler of handlers) {
    const maybe = handler(req, res, next);
    if (maybe && typeof maybe.then === 'function') {
      await maybe;
    }
    if (res.finished) {
      break;
    }
  }

  return res;
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
      const res = await invokeBillingRoute('/subscriptions/subscribe', 'post', {
        body: { planType: 'starter', currency: 'EUR' },
        user: { id: 123, email: 'u@example.com', company: 'Co' },
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.checkoutUrl, 'https://stripe.example/checkout');
      assert.equal(res.body.planType, 'starter');
      assert.equal(res.body.currency, 'EUR');
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
      const res = await invokeBillingRoute('/subscriptions/switch', 'post', {
        body: { interval: 'year', currency: 'EUR' },
        user: { id: 123, email: 'u@example.com', company: 'Co' },
      });

      assert.equal(res.statusCode, 200, `Expected 200, got ${res.statusCode}. Body: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.planType, 'pro');
      assert.equal(res.body.interval, 'year');
      assert.equal(res.body.changeMode, 'checkout');
      assert.equal(res.body.checkoutUrl, 'https://stripe.example/checkout-change');
      assert.equal(updatedTo, null);
    },
  );
});
