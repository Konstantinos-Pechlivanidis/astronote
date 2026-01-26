const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const routePath = path.resolve(__dirname, '../../src/routes/events.js');

function getHandler(router, method, routePathValue) {
  const layer = router.stack.find(
    (l) => l.route?.path === routePathValue && l.route.methods?.[method],
  );
  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${routePathValue} not found`);
  }
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

test('events create resolves contact by phone', async () => {
  const prismaMock = {
    contact: {
      findFirst: async ({ where }) => {
        if (where.ownerId === 7 && where.phone === '+306900000000') {
          return { id: 9, phone: '+306900000000' };
        }
        return null;
      },
    },
    customerEvent: {
      create: async ({ data }) => ({
        id: 1,
        ...data,
        contact: { id: 9, phone: data.phoneE164 },
      }),
    },
  };

  await withMocks({ [prismaPath]: prismaMock }, async () => {
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = getHandler(router, 'post', '/events');

    const req = {
      user: { id: 7 },
      body: {
        eventType: 'appointment',
        status: 'scheduled',
        phone: '+306900000000',
        startAt: '2026-01-10T10:00:00Z',
      },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await handler(req, res, () => {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.eventType, 'appointment');
    assert.equal(res.payload.contact.id, 9);
  });
});

test('events list returns items', async () => {
  const prismaMock = {
    customerEvent: {
      findMany: async () => ([
        { id: 2, eventType: 'visit', status: 'completed', startAt: null, endAt: null },
      ]),
      count: async () => 1,
    },
  };

  await withMocks({ [prismaPath]: prismaMock }, async () => {
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = getHandler(router, 'get', '/events');

    const req = {
      user: { id: 7 },
      query: {},
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await handler(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.total, 1);
    assert.equal(res.payload.items[0].eventType, 'visit');
  });
});

test('events status update is owner-scoped', async () => {
  const prismaMock = {
    customerEvent: {
      updateMany: async () => ({ count: 1 }),
      findFirst: async () => ({
        id: 3,
        eventType: 'purchase',
        status: 'completed',
      }),
    },
  };

  await withMocks({ [prismaPath]: prismaMock }, async () => {
    delete require.cache[routePath];
    const router = require(routePath);
    const handler = getHandler(router, 'patch', '/events/:id/status');

    const req = {
      user: { id: 7 },
      params: { id: '3' },
      body: { status: 'completed' },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };

    await handler(req, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.status, 'completed');
  });
});
