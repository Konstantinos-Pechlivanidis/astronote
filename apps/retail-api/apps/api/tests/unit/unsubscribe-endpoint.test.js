const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const tokenPath = path.resolve(__dirname, '../../src/services/token.service.js');
const contactsPath = path.resolve(__dirname, '../../src/routes/contacts.js');

function getUnsubscribeHandler(router) {
  const layer = router.stack.find((l) => l.route?.path === '/contacts/unsubscribe');
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test('public unsubscribe updates only intended contact (idempotent)', async () => {
  const originalSecret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  const originalPrisma = require.cache[prismaPath];
  const originalContacts = require.cache[contactsPath];
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret';
  delete require.cache[tokenPath];
  const { generateUnsubscribeToken } = require(tokenPath);
  const token = generateUnsubscribeToken(10, 77, 3);

  let updateCalled = false;
  const prismaMock = {
    contact: {
      findFirst: async ({ where }) => {
        if (where.id === 10 && where.ownerId === 77 && where.isSubscribed === true) {
          return {
            id: 10,
            ownerId: 77,
            isSubscribed: true,
            owner: { company: 'Store' },
          };
        }
        return null;
      },
      update: async ({ where }) => {
        updateCalled = true;
        assert.equal(where.id, 10);
        return { id: 10 };
      },
    },
  };

  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[contactsPath];
  const router = require(contactsPath);
  const handler = getUnsubscribeHandler(router);

  const req = { body: { token } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  try {
    await handler(req, res, () => {});
    assert.equal(updateCalled, true);
    assert.equal(res.payload.status, 'unsubscribed');
  } finally {
    if (originalSecret) {process.env.UNSUBSCRIBE_TOKEN_SECRET = originalSecret;} else {delete process.env.UNSUBSCRIBE_TOKEN_SECRET;}
    if (originalPrisma) {require.cache[prismaPath] = originalPrisma;} else {delete require.cache[prismaPath];}
    if (originalContacts) {require.cache[contactsPath] = originalContacts;} else {delete require.cache[contactsPath];}
  }
});

test('public unsubscribe does not update when token owner mismatches', async () => {
  const originalSecret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  const originalPrisma = require.cache[prismaPath];
  const originalContacts = require.cache[contactsPath];
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret';
  delete require.cache[tokenPath];
  const { generateUnsubscribeToken } = require(tokenPath);
  const token = generateUnsubscribeToken(10, 77, 3);

  let updateCalled = false;
  const prismaMock = {
    contact: {
      findFirst: async () => null,
      update: async () => {
        updateCalled = true;
        return { id: 10 };
      },
    },
  };

  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[contactsPath];
  const router = require(contactsPath);
  const handler = getUnsubscribeHandler(router);

  const req = { body: { token } };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  try {
    await handler(req, res, () => {});
    assert.equal(updateCalled, false);
    assert.equal(res.payload.status, 'already_unsubscribed');
  } finally {
    if (originalSecret) {process.env.UNSUBSCRIBE_TOKEN_SECRET = originalSecret;} else {delete process.env.UNSUBSCRIBE_TOKEN_SECRET;}
    if (originalPrisma) {require.cache[prismaPath] = originalPrisma;} else {delete require.cache[prismaPath];}
    if (originalContacts) {require.cache[contactsPath] = originalContacts;} else {delete require.cache[contactsPath];}
  }
});
