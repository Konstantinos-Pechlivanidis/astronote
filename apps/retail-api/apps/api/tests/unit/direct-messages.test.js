const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const routePath = path.resolve(__dirname, '../../src/routes/directMessages.js');
const walletPath = path.resolve(__dirname, '../../src/services/wallet.service.js');
const subscriptionPath = path.resolve(__dirname, '../../src/services/subscription.service.js');
const reservationPath = path.resolve(__dirname, '../../src/services/credit-reservation.service.js');
const mittoPath = path.resolve(__dirname, '../../src/services/mitto.service.js');
const shortenerPath = path.resolve(__dirname, '../../src/services/urlShortener.service.js');
const tokenPath = path.resolve(__dirname, '../../src/services/token.service.js');
const publicLinkPath = path.resolve(__dirname, '../../src/services/publicLinkBuilder.service.js');

function getDirectSendHandler(router) {
  const layer = router.stack.find((l) => l.route?.path === '/direct-messages');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function withMocks(mocks, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(mocks)) {
    originals[key] = require.cache[key];
    require.cache[key] = { exports: value };
  }
  return fn().finally(() => {
    for (const [key, value] of Object.entries(originals)) {
      if (value) {
        require.cache[key] = value;
      } else {
        delete require.cache[key];
      }
    }
  });
}

test('direct marketing send is blocked for unsubscribed contact', async () => {
  const prismaMock = {
    contact: {
      findFirst: async ({ where }) => {
        if (where.id === 1 && where.ownerId === 99) {
          return { id: 1, phone: '+15550001111', isSubscribed: false };
        }
        return null;
      },
    },
    directMessage: {
      findFirst: async () => null,
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
  }, async () => {
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = getDirectSendHandler(router);

    const req = {
      user: { id: 99 },
      body: { contactId: 1, messageBody: 'Hello', messageType: 'marketing' },
      headers: {},
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await handler(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.code, 'CONTACT_UNSUBSCRIBED');
  });
});

test('direct service send allows unsubscribed contact and skips unsubscribe link', async () => {
  let unsubscribeCalled = false;

  const prismaMock = {
    contact: {
      findFirst: async ({ where }) => {
        if (where.id === 2 && where.ownerId === 42) {
          return { id: 2, phone: '+15550002222', isSubscribed: false };
        }
        if (where.ownerId === 42 && where.phone) {
          return { id: 2, isSubscribed: false };
        }
        return null;
      },
    },
    directMessage: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 123, ...data }),
      update: async () => ({ id: 123 }),
    },
  };

  await withMocks({
    [prismaPath]: prismaMock,
    [walletPath]: { getWalletSummary: async () => ({ available: 10, balance: 10, reservedBalance: 0 }) },
    [subscriptionPath]: { canSendOrSpendCredits: async () => ({ allowed: true }) },
    [reservationPath]: {
      reserveCredits: async () => ({ reservation: { id: 5 } }),
      commitReservationById: async () => ({ transactionId: 77 }),
      releaseReservationById: async () => ({}),
    },
    [mittoPath]: { sendSingle: async () => ({ messageId: 'msg_123' }) },
    [shortenerPath]: { shortenUrlsInText: async (text) => text },
    [tokenPath]: { generateUnsubscribeToken: () => { unsubscribeCalled = true; throw new Error('should not be called'); } },
    [publicLinkPath]: { buildUnsubscribeShortUrl: async () => { unsubscribeCalled = true; throw new Error('should not be called'); } },
  }, async () => {
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = getDirectSendHandler(router);

    const req = {
      user: { id: 42 },
      body: { contactId: 2, messageBody: 'Service notice', messageType: 'service' },
      headers: {},
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await handler(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.status, 'sent');
    assert.equal(res.payload.messageType, 'service');
    assert.equal(unsubscribeCalled, false);
  });
});
