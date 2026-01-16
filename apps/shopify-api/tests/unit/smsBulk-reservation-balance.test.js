import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const prismaMock = {
  shop: { findUnique: jest.fn() },
  creditReservation: { aggregate: jest.fn() },
};

jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
jest.unstable_mockModule('../../services/wallet.js', () => ({
  getAvailableBalance: jest.fn(),
  debit: jest.fn(),
  releaseCredits: jest.fn(),
  reserveCredits: jest.fn(),
  credit: jest.fn(),
  refund: jest.fn(),
}));
jest.unstable_mockModule('../../services/mitto.js', () => ({
  sendBulkMessages: jest.fn(),
}));
jest.unstable_mockModule('../../services/rateLimiter.js', () => ({
  checkAllLimits: async () => ({
    allowed: true,
    trafficAccountLimit: { remaining: 999, resetAt: new Date() },
    tenantLimit: { remaining: 999, resetAt: new Date() },
  }),
}));
jest.unstable_mockModule('../../config/redis.js', () => ({ cacheRedis: { get: async () => null } }));
jest.unstable_mockModule('../../utils/redisSafe.js', () => ({ redisSetExBestEffort: async () => {} }));
jest.unstable_mockModule('../../utils/urlShortener.js', () => ({ shortenUrlsInText: async (t) => t }));
jest.unstable_mockModule('../../services/subscription.js', () => ({ isSubscriptionActive: async () => true }));

const wallet = await import('../../services/wallet.js');
const mitto = await import('../../services/mitto.js');
const { sendBulkSMSWithCredits } = await import('../../services/smsBulk.js');

describe('sendBulkSMSWithCredits: reserved credits are available to that campaign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.shop.findUnique.mockResolvedValue({
      includedSmsPerPeriod: 0,
      usedSmsThisPeriod: 0,
    });
    wallet.getAvailableBalance.mockResolvedValue(0);
    prismaMock.creditReservation.aggregate.mockResolvedValue({ _sum: { amount: 2 } });
    mitto.sendBulkMessages.mockResolvedValue({
      bulkId: 'bulk_1',
      messages: [{ messageId: 'm1' }, { messageId: 'm2' }],
    });
  });

  it('does not block sending when available balance is 0 but reservation exists for campaign', async () => {
    const messages = [
      { shopId: 's1', trafficAccountId: 'ta1', destination: '+10000000001', text: 'hi', internalRecipientId: 'r1', meta: { campaignId: 'c1' } },
      { shopId: 's1', trafficAccountId: 'ta1', destination: '+10000000002', text: 'hi', internalRecipientId: 'r2', meta: { campaignId: 'c1' } },
    ];
    const res = await sendBulkSMSWithCredits(messages, { campaignId: 'c1', jobId: 'j1' });
    expect(res.bulkId).toBe('bulk_1');
    expect(res.results.filter(r => r.sent).length).toBe(2);
    expect(mitto.sendBulkMessages).toHaveBeenCalledTimes(1);
  });
});

