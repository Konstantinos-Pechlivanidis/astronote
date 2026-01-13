const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = path.resolve(__dirname, '../../src/lib/prisma.js');
const servicePath = path.resolve(__dirname, '../../src/services/webhook-replay.service.js');

const createPrismaMock = () => {
  let idCounter = 1;
  const byKey = new Map();
  const byId = new Map();

  const makeKey = (provider, eventId) => `${provider}:${eventId}`;

  return {
    webhookEvent: {
      findUnique: async ({ where }) => {
        const key = makeKey(where.provider_eventId.provider, where.provider_eventId.eventId);
        return byKey.get(key) || null;
      },
      findFirst: async ({ where }) => {
        for (const record of byKey.values()) {
          if (record.payloadHash === where.payloadHash) {
            if (where.ownerId && record.ownerId !== where.ownerId) {
              continue;
            }
            return record;
          }
        }
        return null;
      },
      create: async ({ data }) => {
        const key = makeKey(data.provider, data.eventId);
        if (byKey.has(key)) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const record = {
          id: idCounter++,
          receivedAt: new Date(),
          ...data,
        };
        byKey.set(key, record);
        byId.set(record.id, record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = byId.get(where.id);
        if (!record) {
          throw new Error('Not found');
        }
        const updated = { ...record, ...data };
        byId.set(where.id, updated);
        byKey.set(makeKey(updated.provider, updated.eventId), updated);
        return updated;
      },
    },
  };
};

test('processWebhookWithReplayProtection is idempotent', async () => {
  const prismaMock = createPrismaMock();

  delete require.cache[prismaPath];
  require.cache[prismaPath] = { exports: prismaMock };
  delete require.cache[servicePath];

  const { processWebhookWithReplayProtection } = require(servicePath);

  let processed = 0;
  const processor = async () => {
    processed += 1;
    return { ok: true };
  };

  const first = await processWebhookWithReplayProtection('stripe', 'evt_123', processor, {
    payloadHash: 'hash_1',
    eventType: 'invoice.payment_succeeded',
    ownerId: 1,
    payload: { id: 'evt_123' },
    eventTimestamp: new Date(),
  });

  const second = await processWebhookWithReplayProtection('stripe', 'evt_123', processor, {
    payloadHash: 'hash_1',
    eventType: 'invoice.payment_succeeded',
    ownerId: 1,
    payload: { id: 'evt_123' },
    eventTimestamp: new Date(),
  });

  assert.equal(processed, 1);
  assert.equal(first.processed, true);
  assert.equal(second.processed, false);
  assert.equal(second.reason, 'duplicate');
});
