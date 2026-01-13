import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let listInvoices;

const prismaMock = {
  invoiceRecord: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('Billing tenant isolation (Shopify)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();
    prismaMock.invoiceRecord.findMany.mockResolvedValue([]);
    prismaMock.invoiceRecord.count.mockResolvedValue(0);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: prismaMock }));
    ({ listInvoices } = await import('../../services/invoices.js'));
  });

  it('scopes invoice queries by shopId', async () => {
    await listInvoices('shop_a', { page: 1, pageSize: 10 });

    const findArgs = prismaMock.invoiceRecord.findMany.mock.calls[0][0];
    const countArgs = prismaMock.invoiceRecord.count.mock.calls[0][0];

    expect(findArgs.where.shopId).toBe('shop_a');
    expect(countArgs.where.shopId).toBe('shop_a');
  });
});
