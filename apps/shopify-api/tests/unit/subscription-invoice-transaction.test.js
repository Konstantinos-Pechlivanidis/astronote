import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let recordSubscriptionInvoiceTransaction;

const billingTransactions = [];

const prismaMock = {
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

describe('recordSubscriptionInvoiceTransaction', () => {
  beforeEach(async () => {
    billingTransactions.length = 0;
    jest.clearAllMocks();
    jest.resetModules();
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    ({ recordSubscriptionInvoiceTransaction } = await import('../../services/invoices.js'));
  });

  it('creates a billing transaction once per invoice', async () => {
    const invoice = {
      id: 'in_123',
      currency: 'eur',
      total: 4000,
      payment_intent: 'pi_123',
    };

    const first = await recordSubscriptionInvoiceTransaction('shop_1', invoice, {
      creditsAdded: 100,
    });
    const second = await recordSubscriptionInvoiceTransaction('shop_1', invoice, {
      creditsAdded: 100,
    });

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(billingTransactions).toHaveLength(1);
    expect(billingTransactions[0].stripeSessionId).toBe('in_123');
    expect(billingTransactions[0].amount).toBe(4000);
  });
});
