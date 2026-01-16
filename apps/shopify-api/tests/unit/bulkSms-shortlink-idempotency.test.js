import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('handleBulkSMS unsubscribe shortlink idempotency', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_REDIS = 'true';
    process.env.SKIP_QUEUES = 'true';
    jest.resetModules();
  });

  it('does not resend when retry follows shortlink failure', async () => {
    const sendBulkSMSWithCredits = jest.fn().mockResolvedValue({
      bulkId: 'b1',
      results: [{ internalRecipientId: 'r1', sent: true, messageId: 'm1' }],
      summary: { total: 1, sent: 1, failed: 0 },
      rateLimit: { allowed: true, trafficRemaining: 1, tenantRemaining: 1 },
    });

    const appendUnsubscribeLink = jest
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error('shortener down');
      })
      .mockImplementation(async msg => `${msg}\n\nUnsubscribe: https://short/s1`);

    const recipients = [
      {
        id: 'r1',
        campaignId: 'c1',
        contactId: 'ct1',
        phoneE164: '+15551234567',
        contact: { id: 'ct1', phoneE164: '+15551234567', firstName: 'Ada', lastName: 'Lovelace' },
        campaign: { id: 'c1', message: 'Hello', discountId: null },
      },
    ];

    const findMany = jest
      .fn()
      .mockResolvedValueOnce(recipients) // fetch recipients (run 1)
      .mockResolvedValueOnce(recipients) // currentRecipients (run 1)
      .mockResolvedValueOnce([]) // fetch recipients (run 2)
      .mockResolvedValueOnce([]); // currentRecipients (run 2)

    const prismaMock = {
      campaignRecipient: {
        findMany,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      shop: { findUnique: jest.fn().mockResolvedValue({ shopDomain: 'x.myshopify.com' }) },
      $transaction: jest.fn(async fn =>
        fn({
          campaignRecipient: {
            findMany,
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          messageLog: { createMany: jest.fn() },
        }),
      ),
    };

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    jest.unstable_mockModule('../../services/smsBulk.js', () => ({ sendBulkSMSWithCredits }));
    jest.unstable_mockModule('../../services/shopify.js', () => ({ getDiscountCode: jest.fn().mockResolvedValue({ code: 'SAVE' }) }));
    jest.unstable_mockModule('../../services/campaignAggregates.js', () => ({ updateCampaignAggregates: jest.fn() }));
    jest.unstable_mockModule('../../utils/personalization.js', () => ({ replacePlaceholders: t => t }));
    jest.unstable_mockModule('../../utils/urlShortener.js', () => ({ shortenUrlsInText: async t => t }));
    jest.unstable_mockModule('../../utils/unsubscribe.js', () => ({ appendUnsubscribeLink }));
    jest.unstable_mockModule('../../config/redis.js', () => ({
      cacheRedis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
        del: jest.fn(),
        connect: jest.fn(),
      },
      queueRedis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
        del: jest.fn(),
        connect: jest.fn(),
        status: 'ready',
      },
    }));
    jest.unstable_mockModule('../../utils/redisSafe.js', () => ({
      redisGetMany: jest.fn().mockResolvedValue([null]),
      redisSetExBestEffort: jest.fn(),
      redisSetNxWithTtl: jest.fn().mockResolvedValue(true),
      redisDelMany: jest.fn(),
      sha256Hex: v => v,
    }));

    const { handleBulkSMS } = await import('../../queue/jobs/bulkSms.js');

    await expect(
      handleBulkSMS({
        id: 'job1',
        attemptsMade: 0,
        data: { campaignId: 'c1', shopId: 's1', recipientIds: ['r1'] },
      }),
    ).resolves.toBeTruthy();

    await expect(
      handleBulkSMS({
        id: 'job2',
        attemptsMade: 1,
        data: { campaignId: 'c1', shopId: 's1', recipientIds: ['r1'] },
      }),
    ).resolves.toBeTruthy();

    expect(sendBulkSMSWithCredits).toHaveBeenCalledTimes(1);
    expect(appendUnsubscribeLink).toHaveBeenCalledTimes(1);
  });
});
