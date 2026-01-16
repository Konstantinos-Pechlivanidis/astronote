import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const prismaMock = {
  campaign: { findFirst: jest.fn(), update: jest.fn() },
  creditReservation: { findFirst: jest.fn() },
  $transaction: jest.fn(async (cb) => cb(prismaMock)),
};

jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
jest.unstable_mockModule('../../services/wallet.js', () => ({
  releaseCredits: jest.fn(async (_id, _opts, _tx) => ({ ok: true })),
  // Provide stubs for other named exports to avoid cross-suite ESM mock collisions
  debit: jest.fn(),
  getAvailableBalance: jest.fn(),
  reserveCredits: jest.fn(),
  credit: jest.fn(),
  refund: jest.fn(),
}));

const wallet = await import('../../services/wallet.js');
const { updateCampaignStatusFromRecipients } = await import('../../services/delivery-status.js');

describe('campaign finalization releases credit reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('releases active reservation when pending==0 and campaign becomes completed', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue({
      id: 'c1',
      shopId: 's1',
      status: 'sending',
      recipients: [{ status: 'sent' }, { status: 'failed' }],
    });
    prismaMock.creditReservation.findFirst.mockResolvedValue({ id: 'res1' });
    prismaMock.campaign.update.mockResolvedValue({ id: 'c1' });

    await updateCampaignStatusFromRecipients('c1');

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(wallet.releaseCredits).toHaveBeenCalledWith(
      'res1',
      { reason: 'campaign_completed_finalize' },
      prismaMock,
    );
  });
});

