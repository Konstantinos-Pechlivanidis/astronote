import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Billing Invoices - Stripe Fallback', () => {
  let listInvoices;
  let mockPrisma;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock Prisma
    mockPrisma = {
      invoiceRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      shop: {
        findUnique: jest.fn(),
      },
    };

    // Mock logger
    jest.unstable_mockModule('../../utils/logger.js', () => ({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    }));

    // Mock Prisma
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));

    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    ({ listInvoices } = await import('../../services/invoices.js'));
  });

  it('returns empty list when DB is empty and shop has no stripeCustomerId', async () => {
    const shopId = 'shop_123';

    // DB is empty
    mockPrisma.invoiceRecord.findMany.mockResolvedValue([]);
    mockPrisma.invoiceRecord.count.mockResolvedValue(0);

    // Shop has no stripeCustomerId
    mockPrisma.shop.findUnique.mockResolvedValue({
      id: shopId,
      stripeCustomerId: null,
    });

    const result = await listInvoices(shopId, { page: 1, pageSize: 20 });

    expect(result.invoices).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });

  it('returns DB invoices when available (no Stripe fallback)', async () => {
    const shopId = 'shop_123';

    mockPrisma.invoiceRecord.findMany.mockResolvedValue([
      {
        id: 'record_1',
        stripeInvoiceId: 'in_db_1',
        invoiceNumber: 'INV-DB-001',
        status: 'paid',
        subtotal: 1999,
        tax: 0,
        total: 1999,
        currency: 'EUR',
        issuedAt: new Date(1735689600 * 1000),
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/in_db_1',
        pdfUrl: 'https://invoice.stripe.com/pdf/in_db_1',
      },
    ]);
    mockPrisma.invoiceRecord.count.mockResolvedValue(1);

    const result = await listInvoices(shopId, { page: 1, pageSize: 20 });

    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0].stripeInvoiceId).toBe('in_db_1');
    expect(result.invoices[0].total).toBe(19.99);
  });
});

