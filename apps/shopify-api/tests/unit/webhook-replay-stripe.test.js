import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let eventStore = [];
let processWebhookWithReplayProtection;

const prismaMock = {
  webhookEvent: {
    findUnique: jest.fn(({ where }) => {
      return (
        eventStore.find(
          (event) =>
            event.provider === where.provider_eventId.provider &&
            event.eventId === where.provider_eventId.eventId,
        ) || null
      );
    }),
    findFirst: jest.fn(({ where }) => {
      const matchesHash = (event) => {
        if (!where.OR) return false;
        return where.OR.some((condition) => {
          if (condition.eventHash) return event.eventHash === condition.eventHash;
          if (condition.payloadHash) return event.payloadHash === condition.payloadHash;
          return false;
        });
      };
      return (
        eventStore.find(
          (event) =>
            event.provider === where.provider &&
            (!where.shopId || event.shopId === where.shopId) &&
            matchesHash(event),
        ) || null
      );
    }),
    create: jest.fn(({ data }) => {
      const record = {
        ...data,
        id: `evt_${eventStore.length + 1}`,
        receivedAt: new Date(),
      };
      eventStore.push(record);
      return record;
    }),
    update: jest.fn(({ where, data }) => {
      const index = eventStore.findIndex((event) => event.id === where.id);
      if (index === -1) return null;
      eventStore[index] = {
        ...eventStore[index],
        ...data,
      };
      return eventStore[index];
    }),
  },
};

describe('Webhook replay protection (Stripe)', () => {
  beforeEach(async () => {
    eventStore = [];
    jest.clearAllMocks();
    jest.resetModules();
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    ({ processWebhookWithReplayProtection } = await import('../../services/webhook-replay.js'));
  });

  it('processes a webhook only once', async () => {
    let processedCount = 0;
    const processor = async () => {
      processedCount += 1;
      return { ok: true };
    };

    const first = await processWebhookWithReplayProtection(
      'stripe',
      'evt_123',
      processor,
      { eventHash: 'hash_123', payloadHash: 'hash_123', shopId: 'shop_1' },
    );

    const second = await processWebhookWithReplayProtection(
      'stripe',
      'evt_123',
      processor,
      { eventHash: 'hash_123', payloadHash: 'hash_123', shopId: 'shop_1' },
    );

    expect(first.processed).toBe(true);
    expect(second.processed).toBe(false);
    expect(processedCount).toBe(1);
  });

  it('detects replay by payload hash', async () => {
    let processedCount = 0;
    const processor = async () => {
      processedCount += 1;
      return { ok: true };
    };

    await processWebhookWithReplayProtection(
      'stripe',
      'evt_abc',
      processor,
      { eventHash: 'hash_abc', payloadHash: 'hash_abc', shopId: 'shop_1' },
    );

    const replay = await processWebhookWithReplayProtection(
      'stripe',
      'evt_xyz',
      processor,
      { eventHash: 'hash_abc', payloadHash: 'hash_abc', shopId: 'shop_1' },
    );

    expect(replay.processed).toBe(false);
    expect(processedCount).toBe(1);
  });
});
