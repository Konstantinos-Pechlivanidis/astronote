import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  campaign: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  campaignRecipient: {
    findMany: jest.fn(),
  },
  creditReservation: {
    findFirst: jest.fn(),
  },
};

const mockSmsQueue = {
  getWaiting: jest.fn(),
  getActive: jest.fn(),
  getDelayed: jest.fn(),
  getJob: jest.fn(),
  add: jest.fn(),
};

const mockWallet = {
  releaseCredits: jest.fn(),
};

const mockBatchMetrics = {
  getCanonicalMetricsForCampaignIds: jest.fn(),
};

describe('Campaign reconciliation (Shopify) — no resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));
    jest.unstable_mockModule('../../queue/index.js', () => ({ smsQueue: mockSmsQueue }));
    jest.unstable_mockModule('../../services/wallet.js', () => mockWallet);
    jest.unstable_mockModule('../../services/campaign-metrics-batch.js', () => mockBatchMetrics);
  });

  it('only queries pending recipients with mittoMessageId=null and never resends accepted ones', async () => {
    const { reconcileCampaign } = await import('../../services/campaign-reconciliation.js');

    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: 'c1',
      shopId: 'shop_1',
      status: 'sending',
      updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    mockBatchMetrics.getCanonicalMetricsForCampaignIds.mockResolvedValueOnce(
      new Map([
        ['c1', { totals: { recipients: 2, accepted: 1, delivered: 0, failed: 0 }, delivery: { delivered: 0, failedDelivery: 0, pendingDelivery: 1 } }],
      ]),
    );

    mockPrisma.campaignRecipient.findMany.mockResolvedValueOnce([{ id: 'r_pending' }]);

    mockSmsQueue.getWaiting.mockResolvedValueOnce([]);
    mockSmsQueue.getActive.mockResolvedValueOnce([]);
    mockSmsQueue.getDelayed.mockResolvedValueOnce([]);
    mockSmsQueue.getJob.mockResolvedValueOnce(null);

    const result = await reconcileCampaign('shop_1', 'c1', { staleMinutes: 15 });

    // Ensure reconcile selects only unsent pending recipients
    expect(mockPrisma.campaignRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: 'c1',
          status: 'pending',
          mittoMessageId: null,
        }),
      }),
    );

    // Ensure it enqueued work for pending recipients only (no resend)
    expect(mockSmsQueue.add).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});


