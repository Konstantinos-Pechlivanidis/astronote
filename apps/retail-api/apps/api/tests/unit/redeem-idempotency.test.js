const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const trackingPath = path.resolve(__dirname, '../../src/routes/tracking.js');

function getHandler(router, routePath) {
  const layer = router.stack.find((l) => l.route?.path === routePath);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockReqRes(trackingId) {
  const req = {
    params: { trackingId },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    get(header) { return this.headers[header.toLowerCase()] || this.headers[header]; },
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  return { req, res };
}

test('redeem-public is idempotent when redemption exists', async () => {
  const prismaMock = {
    campaignMessage: {
      findUnique: async () => ({ id: 10, campaignId: 3, contactId: 5, ownerId: 7 }),
    },
    redemption: {
      findUnique: async () => ({ redeemedAt: new Date('2024-01-01T00:00:00Z') }),
      create: async () => {
        throw new Error('create should not be called');
      },
    },
  };

  const originalPrisma = require.cache[prismaPath];
  delete require.cache[trackingPath];
  require.cache[prismaPath] = { exports: prismaMock };
  const router = require(trackingPath);
  const handler = getHandler(router, '/redeem-public/:trackingId');

  const { req, res } = mockReqRes('abc12345');
  await handler(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.status, 'already_redeemed');

  if (originalPrisma) {require.cache[prismaPath] = originalPrisma;} else {delete require.cache[prismaPath];}
  delete require.cache[trackingPath];
});

test('redeem-public handles unique constraint by returning existing redemption', async () => {
  let createCalled = false;
  let findCallCount = 0;
  const prismaMock = {
    campaignMessage: {
      findUnique: async () => ({ id: 11, campaignId: 4, contactId: 6, ownerId: 8 }),
    },
    redemption: {
      findUnique: async () => {
        findCallCount += 1;
        if (findCallCount === 1) {
          return null;
        }
        return { redeemedAt: new Date('2024-02-01T00:00:00Z') };
      },
      create: async () => {
        createCalled = true;
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      },
    },
  };

  const originalPrisma = require.cache[prismaPath];
  delete require.cache[trackingPath];
  require.cache[prismaPath] = { exports: prismaMock };
  const router = require(trackingPath);
  const handler = getHandler(router, '/redeem-public/:trackingId');

  const { req, res } = mockReqRes('abc12345');
  await handler(req, res, () => {});

  assert.equal(createCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.status, 'already_redeemed');

  if (originalPrisma) {require.cache[prismaPath] = originalPrisma;} else {delete require.cache[prismaPath];}
  delete require.cache[trackingPath];
});
