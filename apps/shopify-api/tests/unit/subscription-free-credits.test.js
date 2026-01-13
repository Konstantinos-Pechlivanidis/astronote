import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let allocateFreeCredits;

const creditTransactions = [];

const prismaMock = {
  shop: {
    findUnique: jest.fn(() => ({
      planType: 'starter',
      subscriptionStatus: 'active',
      lastFreeCreditsAllocatedAt: null,
    })),
    update: jest.fn(),
  },
  creditTransaction: {
    findFirst: jest.fn(({ where }) =>
      creditTransactions.find((txn) => {
        if (txn.shopId !== where.shopId) return false;
        if (txn.reason !== where.reason) return false;
        if (!where.meta?.path || where.meta.path[0] !== 'invoiceId') return false;
        return txn.meta.invoiceId === where.meta.equals;
      }) || null,
    ),
  },
  $transaction: async (callback) => callback(prismaMock),
};

const creditMock = jest.fn(async (shopId, amount, details) => {
  creditTransactions.push({
    shopId,
    amount,
    reason: details.reason,
    meta: details.meta,
  });
});

describe('allocateFreeCredits', () => {
  beforeEach(async () => {
    creditTransactions.length = 0;
    jest.clearAllMocks();
    jest.resetModules();
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    jest.unstable_mockModule('../../services/wallet.js', () => ({ credit: creditMock }));
    ({ allocateFreeCredits } = await import('../../services/subscription.js'));
  });

  it('allocates free credits once per invoice', async () => {
    const invoiceId = 'in_456';

    const first = await allocateFreeCredits('shop_1', 'starter', invoiceId, null);
    const second = await allocateFreeCredits('shop_1', 'starter', invoiceId, null);

    expect(first.allocated).toBe(true);
    expect(second.allocated).toBe(false);
    expect(creditMock).toHaveBeenCalledTimes(1);
    expect(creditTransactions).toHaveLength(1);
    expect(creditTransactions[0].meta.invoiceId).toBe(invoiceId);
  });
});
