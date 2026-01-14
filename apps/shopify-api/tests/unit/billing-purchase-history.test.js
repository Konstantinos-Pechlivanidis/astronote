import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Billing Purchase History Endpoint', () => {
  let getBillingHistory;
  let mockPrisma;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    mockPrisma = {
      billingTransaction: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      package: {
        findUnique: jest.fn(),
      },
      invoiceRecord: {
        findFirst: jest.fn(),
      },
    };

    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));
    jest.unstable_mockModule('../../utils/logger.js', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));

    ({ getBillingHistory } = await import('../../services/billing.js'));
  });

  it('returns unified purchase history with transaction types', async () => {
    const shopId = 'shop_123';

    const mockTransactions = [
      {
        id: 'bt_1',
        shopId,
        creditsAdded: 100,
        amount: 0,
        currency: 'EUR',
        packageType: 'subscription_included_starter',
        stripeSessionId: 'in_123',
        stripePaymentId: null,
        idempotencyKey: 'free_credits:invoice:in_123',
        status: 'completed',
        createdAt: new Date('2025-01-01'),
      },
      {
        id: 'bt_2',
        shopId,
        creditsAdded: 0,
        amount: 2999,
        currency: 'EUR',
        packageType: 'subscription',
        stripeSessionId: 'in_456',
        stripePaymentId: 'pi_456',
        idempotencyKey: 'stripe:invoice:in_456',
        status: 'completed',
        createdAt: new Date('2025-01-15'),
      },
      {
        id: 'bt_3',
        shopId,
        creditsAdded: 500,
        amount: 4999,
        currency: 'EUR',
        packageType: 'credit_pack_purchase',
        stripeSessionId: 'cs_789',
        stripePaymentId: 'pi_789',
        idempotencyKey: 'stripe:topup:cs_789',
        status: 'completed',
        createdAt: new Date('2025-01-20'),
      },
    ];

    mockPrisma.billingTransaction.findMany.mockResolvedValue(mockTransactions);
    mockPrisma.billingTransaction.count.mockResolvedValue(3);
    mockPrisma.package.findUnique.mockResolvedValue(null); // No package found
    mockPrisma.invoiceRecord.findFirst.mockResolvedValue({
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/in_456',
    });

    const result = await getBillingHistory(shopId, { page: 1, pageSize: 20 });

    expect(result.transactions).toHaveLength(3);

    // Verify first transaction (free credits)
    const freeCreditsTxn = result.transactions[0]; // Most recent first
    expect(freeCreditsTxn.type).toBe('subscription_included_credits');
    expect(freeCreditsTxn.title).toBe('Included Credits');
    expect(freeCreditsTxn.subtitle).toContain('Free credits included');
    expect(freeCreditsTxn.amount).toBe(0);
    expect(freeCreditsTxn.creditsGranted).toBe(100);

    // Verify second transaction (subscription charge)
    const subscriptionTxn = result.transactions[1];
    expect(subscriptionTxn.type).toBe('subscription_charge');
    expect(subscriptionTxn.title).toBe('Subscription Payment');
    expect(subscriptionTxn.subtitle).toContain('Recurring subscription charge');
    expect(subscriptionTxn.amount).toBe(29.99);
    expect(subscriptionTxn.linkUrl).toBe('https://invoice.stripe.com/i/in_456');

    // Verify third transaction (credit pack)
    const creditPackTxn = result.transactions[2];
    expect(creditPackTxn.type).toBe('credit_pack_purchase');
    expect(creditPackTxn.title).toBe('Credit Pack Purchase');
    expect(creditPackTxn.amount).toBe(49.99);
    expect(creditPackTxn.creditsGranted).toBe(500);
  });

  it('scopes queries by shopId (tenant isolation)', async () => {
    const shopId = 'shop_a';

    mockPrisma.billingTransaction.findMany.mockResolvedValue([]);
    mockPrisma.billingTransaction.count.mockResolvedValue(0);

    await getBillingHistory(shopId, { page: 1, pageSize: 20 });

    const findArgs = mockPrisma.billingTransaction.findMany.mock.calls[0][0];
    const countArgs = mockPrisma.billingTransaction.count.mock.calls[0][0];

    expect(findArgs.where.shopId).toBe('shop_a');
    expect(countArgs.where.shopId).toBe('shop_a');
  });

  it('handles empty purchase history', async () => {
    const shopId = 'shop_123';

    mockPrisma.billingTransaction.findMany.mockResolvedValue([]);
    mockPrisma.billingTransaction.count.mockResolvedValue(0);

    const result = await getBillingHistory(shopId, { page: 1, pageSize: 20 });

    expect(result.transactions).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('filters by status when provided', async () => {
    const shopId = 'shop_123';

    mockPrisma.billingTransaction.findMany.mockResolvedValue([]);
    mockPrisma.billingTransaction.count.mockResolvedValue(0);

    await getBillingHistory(shopId, { page: 1, pageSize: 20, status: 'completed' });

    const findArgs = mockPrisma.billingTransaction.findMany.mock.calls[0][0];
    expect(findArgs.where.status).toBe('completed');
  });
});

