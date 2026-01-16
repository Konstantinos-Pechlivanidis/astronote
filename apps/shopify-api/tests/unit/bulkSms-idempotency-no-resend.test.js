import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('bulkSms idempotency: no resend after provider success', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SKIP_REDIS = 'true';
    process.env.SKIP_QUEUES = 'true';
    jest.resetModules();
  });

  it('does not retry-send when provider succeeded but DB persist failed; second run skips provider call', async () => {
    const sendBulkSMSWithCredits = jest.fn().mockResolvedValue({
      bulkId: 'b1',
      results: [
        { internalRecipientId: 'r1', sent: true, messageId: 'm1' },
      ],
      summary: { total: 1, sent: 1, failed: 0 },
    });

    const recipients = [
      {
        id: 'r1',
        campaignId: 'c1',
        contactId: 'ct1',
        phoneE164: '+15551234567',
        contact: { id: 'ct1', phoneE164: '+15551234567', firstName: 'A', lastName: 'B' },
        campaign: { id: 'c1', message: 'Hello', discountId: null },
      },
    ];

    const prismaMock = {
      campaignRecipient: {
        findMany: jest.fn().mockResolvedValue(recipients),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      shop: { findUnique: jest.fn().mockResolvedValue({ shopDomain: 'x.myshopify.com' }) },
      $transaction: jest.fn(),
    };
    // Transaction behavior:
    // - Snapshot transactions should always succeed
    // - The first post-send persist transaction should fail (simulates DB failure after provider)
    let txCall = 0;
    prismaMock.$transaction.mockImplementation(async (fn) => {
      txCall += 1;
      // 2nd call is the post-send persist attempt in the first handleBulkSMS run
      if (txCall === 2) {
        throw new Error('DB persist failed');
      }
      return fn({ campaignRecipient: prismaMock.campaignRecipient, messageLog: { createMany: jest.fn() } });
    });

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    jest.unstable_mockModule('../../services/smsBulk.js', () => ({ sendBulkSMSWithCredits }));
    jest.unstable_mockModule('../../services/shopify.js', () => ({ getDiscountCode: jest.fn() }));
    jest.unstable_mockModule('../../services/campaignAggregates.js', () => ({ updateCampaignAggregates: jest.fn() }));
    jest.unstable_mockModule('../../utils/personalization.js', () => ({ replacePlaceholders: (t) => t }));
    jest.unstable_mockModule('../../utils/urlShortener.js', () => ({ shortenUrlsInText: async (t) => t }));
    jest.unstable_mockModule('../../utils/unsubscribe.js', () => ({ appendUnsubscribeLink: async (t) => `${t}\n\nUnsubscribe: https://x/s/abc` }));

    const { handleBulkSMS } = await import('../../queue/jobs/bulkSms.js');

    // First run: provider called, DB persist fails -> handler must NOT throw
    await expect(handleBulkSMS({ id: 'job1', attemptsMade: 0, data: { campaignId: 'c1', shopId: 's1', recipientIds: ['r1'] } })).resolves.toBeTruthy();
    expect(sendBulkSMSWithCredits).toHaveBeenCalledTimes(1);

    // Second run (retry): should skip provider call due to redis sent marker
    await expect(handleBulkSMS({ id: 'job2', attemptsMade: 1, data: { campaignId: 'c1', shopId: 's1', recipientIds: ['r1'] } })).resolves.toBeTruthy();
    expect(sendBulkSMSWithCredits).toHaveBeenCalledTimes(1);
  });
});

