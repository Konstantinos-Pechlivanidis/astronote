import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('campaign reconciliation cooldown', () => {
  const redisStore = new Map();

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_REDIS = 'true';
    redisStore.clear();
    jest.resetModules();
  });

  it('skips re-enqueue when cooldown flag is set', async () => {
    const smsQueue = {
      addedJobs: [],
      getWaiting: jest.fn().mockResolvedValue([]),
      getActive: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
      add: jest.fn(async (_name, data) => {
        smsQueue.addedJobs.push(data);
        return true;
      }),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const campaign = { id: 'c1', shopId: 's1', status: 'sending', updatedAt: new Date(Date.now() - 20 * 60 * 1000), recipients: [] };
    const prismaMock = {
      campaign: {
        findMany: jest.fn().mockResolvedValue([campaign]),
        update: jest.fn(),
      },
      campaignRecipient: {
        findMany: jest
          .fn()
          // recomputeCampaignProgress
          .mockResolvedValueOnce([{ status: 'pending', mittoMessageId: null }])
          // pendingRecipients (first run)
          .mockResolvedValueOnce([{ id: 'r1' }])
          // recomputeCampaignProgress (second run)
          .mockResolvedValueOnce([{ status: 'pending', mittoMessageId: null }])
          // pendingRecipients (second run - should be skipped)
          .mockResolvedValueOnce([{ id: 'r1' }]),
      },
      creditReservation: { findMany: jest.fn().mockResolvedValue([]) },
    };

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    jest.unstable_mockModule('../../queue/index.js', () => ({ smsQueue }));
    jest.unstable_mockModule('../../services/wallet.js', () => ({ releaseCredits: jest.fn() }));
    jest.unstable_mockModule('../../config/redis.js', () => ({
      cacheRedis: {
        get: jest.fn(async key => redisStore.get(key) || null),
        set: jest.fn(async (key, value) => {
          redisStore.set(key, value);
          return 'OK';
        }),
        setEx: jest.fn(async (key, _ttl, value) => {
          redisStore.set(key, value);
          return 'OK';
        }),
        connect: jest.fn(),
      },
    }));
    jest.unstable_mockModule('../../utils/redisSafe.js', () => ({
      sha256Hex: v => v,
      redisSetExBestEffort: jest.fn(async (_redis, key, _ttl, value) => {
        redisStore.set(key, value);
      }),
    }));

    const { handleReconciliation } = await import('../../queue/jobs/reconciliation.js');

    const firstRun = await handleReconciliation();
    expect(firstRun.reEnqueued).toBeGreaterThan(0);
    expect(smsQueue.add).toHaveBeenCalledTimes(1);

    const secondRun = await handleReconciliation();
    expect(secondRun.reEnqueued).toBe(0);
    expect(smsQueue.add).toHaveBeenCalledTimes(1);
  });
});
