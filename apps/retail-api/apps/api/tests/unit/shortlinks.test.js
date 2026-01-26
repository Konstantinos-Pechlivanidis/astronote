const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const shortenerPath = path.resolve(__dirname, '../../src/services/urlShortener.service.js');
const builderPath = path.resolve(__dirname, '../../src/services/publicLinkBuilder.service.js');
const publicShortRoutesPath = path.resolve(__dirname, '../../src/routes/publicShort.routes.js');
const prisma = require('../../src/lib/prisma');

test('shortenUrl reuses the same short code per owner/kind for identical URLs', async (t) => {
  const originalBase = process.env.PUBLIC_RETAIL_BASE_URL;
  process.env.PUBLIC_RETAIL_BASE_URL = 'https://links.test';
  delete require.cache[shortenerPath];
  const { shortenUrl, normalizeUrl, hashUrl } = require(shortenerPath);

  const store = new Map();
  let createCount = 0;

  const originalDelegate = prisma.shortLink;
  prisma.shortLink = {
    findFirst: async ({ where }) => {
      for (const record of store.values()) {
        if (
          record.ownerId === where.ownerId &&
          record.kind === where.kind &&
          record.longUrlHash === where.longUrlHash
        ) {
          return record;
        }
      }
      return null;
    },
    create: async ({ data }) => {
      createCount += 1;
      const record = { id: store.size + 1, ...data };
      store.set(record.id, record);
      return record;
    },
    update: async ({ where, data }) => {
      const record = store.get(where.id);
      if (!record) {return null;}
      const updated = { ...record, ...data };
      store.set(where.id, updated);
      return updated;
    },
  };

  const urlA = 'https://astronote.test/retail/tracking/offer/ABC?a=1&b=2';
  const urlB = 'https://astronote.test/retail/tracking/offer/ABC?b=2&a=1';

  const normalized = normalizeUrl(urlA);
  const expectedHash = hashUrl(normalized);

  try {
    const first = await shortenUrl(urlA, { ownerId: 10, kind: 'offer', requireShort: true, forceShort: true });
    const second = await shortenUrl(urlB, { ownerId: 10, kind: 'offer', requireShort: true, forceShort: true });

    assert.equal(first, second);
    assert.equal(createCount, 1);

    const saved = [...store.values()][0];
    assert.equal(saved.longUrlHash, expectedHash);
  } finally {
    if (originalBase) {process.env.PUBLIC_RETAIL_BASE_URL = originalBase;} else {delete process.env.PUBLIC_RETAIL_BASE_URL;}
    prisma.shortLink = originalDelegate;
    t.mock.restoreAll();
  }
});

test('public short route redirects to target URL', async (t) => {
  const originalBase = process.env.PUBLIC_WEB_BASE_URL;
  process.env.PUBLIC_WEB_BASE_URL = 'https://example.com';
  delete require.cache[publicShortRoutesPath];
  const router = require(publicShortRoutesPath);
  const layer = router.stack.find((l) => l.route?.path === '/public/s/:shortCode');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const mockLink = { shortCode: 'abc12345', targetUrl: 'https://example.com/landing' };

  const originalDelegate = prisma.shortLink;
  let updated = false;
  prisma.shortLink = {
    findUnique: async () => mockLink,
    update: async () => {
      updated = true;
      return mockLink;
    },
  };

  const req = { params: { shortCode: 'abc12345' } };
  let redirectInfo = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { redirectInfo = { code, url }; return this; },
  };

  try {
    await handler(req, res, () => {});

    assert.equal(redirectInfo.code, 302);
    assert.equal(redirectInfo.url, mockLink.targetUrl);
    assert.equal(updated, true);
  } finally {
    if (originalBase) {process.env.PUBLIC_WEB_BASE_URL = originalBase;} else {delete process.env.PUBLIC_WEB_BASE_URL;}
    prisma.shortLink = originalDelegate;
    t.mock.restoreAll();
  }
});

test('public short route blocks non-http targets', async (t) => {
  const originalBase = process.env.PUBLIC_WEB_BASE_URL;
  process.env.PUBLIC_WEB_BASE_URL = 'https://example.com';
  delete require.cache[publicShortRoutesPath];
  const router = require(publicShortRoutesPath);
  const layer = router.stack.find((l) => l.route?.path === '/public/s/:shortCode');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const mockLink = { shortCode: 'abc12345', targetUrl: 'javascript:alert(1)' };

  const originalDelegate = prisma.shortLink;
  let updated = false;
  prisma.shortLink = {
    findUnique: async () => mockLink,
    update: async () => {
      updated = true;
      return mockLink;
    },
  };

  const req = { params: { shortCode: 'abc12345' } };
  let redirectInfo = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { redirectInfo = { code, url }; return this; },
  };

  try {
    await handler(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(redirectInfo, null);
    assert.equal(updated, false);
  } finally {
    if (originalBase) {process.env.PUBLIC_WEB_BASE_URL = originalBase;} else {delete process.env.PUBLIC_WEB_BASE_URL;}
    prisma.shortLink = originalDelegate;
    t.mock.restoreAll();
  }
});

test('public short route blocks unapproved domains', async (t) => {
  const originalBase = process.env.PUBLIC_WEB_BASE_URL;
  process.env.PUBLIC_WEB_BASE_URL = 'https://allowed.test';
  delete require.cache[publicShortRoutesPath];
  const router = require(publicShortRoutesPath);
  const layer = router.stack.find((l) => l.route?.path === '/public/s/:shortCode');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const mockLink = { shortCode: 'abc12345', targetUrl: 'https://evil.com/landing' };

  const originalDelegate = prisma.shortLink;
  let updated = false;
  prisma.shortLink = {
    findUnique: async () => mockLink,
    update: async () => {
      updated = true;
      return mockLink;
    },
  };

  const req = { params: { shortCode: 'abc12345' } };
  let redirectInfo = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { redirectInfo = { code, url }; return this; },
  };

  try {
    await handler(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(redirectInfo, null);
    assert.equal(updated, false);
  } finally {
    if (originalBase) {process.env.PUBLIC_WEB_BASE_URL = originalBase;} else {delete process.env.PUBLIC_WEB_BASE_URL;}
    prisma.shortLink = originalDelegate;
    t.mock.restoreAll();
  }
});

test('public short route rejects invalid short codes', async (t) => {
  const originalBase = process.env.PUBLIC_WEB_BASE_URL;
  process.env.PUBLIC_WEB_BASE_URL = 'https://example.com';
  delete require.cache[publicShortRoutesPath];
  const router = require(publicShortRoutesPath);
  const layer = router.stack.find((l) => l.route?.path === '/public/s/:shortCode');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const req = { params: { shortCode: 'bad!' } };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await handler(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.code, 'VALIDATION_ERROR');
  } finally {
    if (originalBase) {process.env.PUBLIC_WEB_BASE_URL = originalBase;} else {delete process.env.PUBLIC_WEB_BASE_URL;}
    t.mock.restoreAll();
  }
});

test('public short route enforces owner match for unsubscribe links', async (t) => {
  const tokenServicePath = path.resolve(__dirname, '../../src/services/token.service.js');
  const originalSecret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  const originalBase = process.env.PUBLIC_WEB_BASE_URL;
  process.env.PUBLIC_WEB_BASE_URL = 'https://astronote.onrender.com';
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret';
  delete require.cache[tokenServicePath];
  const { generateUnsubscribeToken } = require(tokenServicePath);
  const token = generateUnsubscribeToken(10, 55);

  delete require.cache[publicShortRoutesPath];
  const router = require(publicShortRoutesPath);
  const layer = router.stack.find((l) => l.route?.path === '/public/s/:shortCode');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;

  const mockLink = {
    shortCode: 'abc12345',
    kind: 'unsubscribe',
    ownerId: 54,
    targetUrl: `https://astronote.onrender.com/unsubscribe/${token}`,
  };

  const originalDelegate = prisma.shortLink;
  let updated = false;
  prisma.shortLink = {
    findUnique: async () => mockLink,
    update: async () => {
      updated = true;
      return mockLink;
    },
  };

  const req = { params: { shortCode: 'abc12345' } };
  let redirectInfo = null;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, url) { redirectInfo = { code, url }; return this; },
  };

  try {
    await handler(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(redirectInfo, null);
    assert.equal(updated, false);
  } finally {
    prisma.shortLink = originalDelegate;
    if (originalSecret) {process.env.UNSUBSCRIBE_TOKEN_SECRET = originalSecret;} else {delete process.env.UNSUBSCRIBE_TOKEN_SECRET;}
    if (originalBase) {process.env.PUBLIC_WEB_BASE_URL = originalBase;} else {delete process.env.PUBLIC_WEB_BASE_URL;}
    t.mock.restoreAll();
  }
});

test('unsubscribe builder requests strict short links', async (t) => {
  delete require.cache[shortenerPath];
  const shortener = require(shortenerPath);
  const shortenMock = t.mock.method(shortener, 'shortenUrl', async (_url, opts = {}) => {
    return `https://links.test/s/mock-${opts.ownerId}`;
  });

  delete require.cache[builderPath];
  const { buildUnsubscribeShortUrl } = require(builderPath);

  try {
    const result = await buildUnsubscribeShortUrl({
      token: 'token-123',
      ownerId: 77,
      campaignId: 99,
      campaignMessageId: 111,
    });

    assert.equal(result.shortUrl, 'https://links.test/s/mock-77');
    const call = shortenMock.mock.calls[0];
    assert.equal(call.arguments[1].ownerId, 77);
    assert.equal(call.arguments[1].campaignId, 99);
    assert.equal(call.arguments[1].campaignMessageId, 111);
    assert.equal(call.arguments[1].kind, 'unsubscribe');
    assert.equal(call.arguments[1].requireShort, true);
    assert.equal(call.arguments[1].forceShort, true);
  } finally {
    t.mock.restoreAll();
  }
});
