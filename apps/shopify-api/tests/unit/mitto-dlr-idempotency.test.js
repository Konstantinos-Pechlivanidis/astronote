import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  campaignRecipient: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  messageLog: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  campaign: {
    findUnique: jest.fn(),
  },
};

const mockWebhookReplay = {
  generateEventHash: jest.fn(() => 'hash'),
  checkWebhookReplay: jest.fn(),
  recordWebhookEvent: jest.fn(),
  markWebhookProcessed: jest.fn(),
};

const mockCampaignAggregates = {
  updateCampaignAggregates: jest.fn(),
};

describe('Mitto DLR webhook idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));
    jest.unstable_mockModule('../../services/webhook-replay.js', () => ({
      default: mockWebhookReplay,
      generateEventHash: mockWebhookReplay.generateEventHash,
      checkWebhookReplay: mockWebhookReplay.checkWebhookReplay,
      recordWebhookEvent: mockWebhookReplay.recordWebhookEvent,
      markWebhookProcessed: mockWebhookReplay.markWebhookProcessed,
    }));
    jest.unstable_mockModule('../../services/campaignAggregates.js', () => mockCampaignAggregates);
  });

  it('processes a DLR event once and skips duplicates via replay protection', async () => {
    const { deliveryReport } = await import('../../controllers/mitto.js');

    // First call: not a replay
    mockWebhookReplay.checkWebhookReplay.mockResolvedValueOnce(null);
    mockWebhookReplay.recordWebhookEvent.mockResolvedValueOnce({ id: 'we1' });

    mockPrisma.campaignRecipient.findFirst.mockResolvedValueOnce({
      id: 'r1',
      campaignId: 'c1',
      status: 'sent',
      sentAt: null,
      campaign: { shopId: 'shop_1' },
    });
    mockPrisma.messageLog.findFirst.mockResolvedValueOnce(null);
    mockPrisma.campaign.findUnique.mockResolvedValueOnce({ shopId: 'shop_1' });

    const req = {
      header: () => '',
      body: [{ messageId: 'm1', deliveryStatus: 'Delivered', updatedAt: new Date().toISOString() }],
    };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    };

    await deliveryReport(req, res);

    // Second call: replay detected
    mockWebhookReplay.checkWebhookReplay.mockResolvedValueOnce({ id: 'we_existing', status: 'processed' });

    await deliveryReport(req, res);

    expect(mockPrisma.campaignRecipient.update).toHaveBeenCalledTimes(1);
    expect(mockWebhookReplay.recordWebhookEvent).toHaveBeenCalledTimes(1);
    expect(mockWebhookReplay.markWebhookProcessed).toHaveBeenCalledTimes(1);
  });
});


