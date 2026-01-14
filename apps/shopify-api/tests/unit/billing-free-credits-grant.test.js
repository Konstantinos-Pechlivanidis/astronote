import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('recordFreeCreditsGrant', () => {
  let recordFreeCreditsGrant;
  let mockPrisma;
  const billingTransactions = [];

  beforeEach(async () => {
    billingTransactions.length = 0;
    jest.clearAllMocks();
    jest.resetModules();

    mockPrisma = {
      billingTransaction: {
        create: jest.fn(({ data }) => {
          const exists = billingTransactions.find(
            (entry) => entry.shopId === data.shopId && entry.idempotencyKey === data.idempotencyKey,
          );
          if (exists) {
            const error = new Error('Unique constraint failed');
            error.code = 'P2002';
            throw error;
          }
          const record = {
            id: `bt_${billingTransactions.length + 1}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          billingTransactions.push(record);
          return record;
        }),
        findFirst: jest.fn(({ where }) =>
          billingTransactions.find(
            (entry) => entry.shopId === where.shopId && entry.idempotencyKey === where.idempotencyKey,
          ) || null,
        ),
      },
    };

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));
    jest.unstable_mockModule('../../utils/logger.js', () => ({
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
      },
    }));

    ({ recordFreeCreditsGrant } = await import('../../services/invoices.js'));
  });

  it('creates a free credits grant transaction', async () => {
    const result = await recordFreeCreditsGrant(
      'shop_1',
      'starter',
      100,
      'in_123',
      { periodStart: '2025-01-01', periodEnd: '2025-02-01' },
    );

    expect(result).toBeTruthy();
    expect(result.amount).toBe(0); // Free credits have no monetary amount
    expect(result.creditsAdded).toBe(100);
    expect(result.packageType).toBe('subscription_included_starter');
    expect(result.idempotencyKey).toBe('free_credits:invoice:in_123');
    expect(result.status).toBe('completed');
    expect(billingTransactions).toHaveLength(1);
  });

  it('is idempotent (same invoice twice creates only one record)', async () => {
    const first = await recordFreeCreditsGrant('shop_1', 'pro', 500, 'in_456');
    const second = await recordFreeCreditsGrant('shop_1', 'pro', 500, 'in_456');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(billingTransactions).toHaveLength(1); // Only one record created
    expect(first.id).toBe(second.id); // Same record returned
  });

  it('returns null for zero or negative credits', async () => {
    const result1 = await recordFreeCreditsGrant('shop_1', 'starter', 0, 'in_123');
    const result2 = await recordFreeCreditsGrant('shop_1', 'starter', -10, 'in_124');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(billingTransactions).toHaveLength(0);
  });

  it('uses fallback idempotency key when invoiceId is missing', async () => {
    const result = await recordFreeCreditsGrant(
      'shop_1',
      'starter',
      100,
      null,
      { periodStart: '2025-01-01T00:00:00Z' },
    );

    expect(result).toBeTruthy();
    expect(result.idempotencyKey).toMatch(/^free_credits:starter:/);
  });

  it('handles different shops independently', async () => {
    await recordFreeCreditsGrant('shop_1', 'starter', 100, 'in_123');
    await recordFreeCreditsGrant('shop_2', 'starter', 100, 'in_123'); // Same invoice ID, different shop

    expect(billingTransactions).toHaveLength(2); // Both shops get their own record
    expect(billingTransactions[0].shopId).toBe('shop_1');
    expect(billingTransactions[1].shopId).toBe('shop_2');
  });
});

