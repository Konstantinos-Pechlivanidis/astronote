import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  shop: {
    findUnique: jest.fn(),
  },
};

// Mock invoices service
const mockInvoicesService = {
  listInvoices: jest.fn(),
  // Needed because billing service statically imports these named exports from invoices.js
  // when controllers/billing.js is imported in this test.
  upsertInvoiceRecord: jest.fn(),
  recordSubscriptionInvoiceTransaction: jest.fn(),
  recordFreeCreditsGrant: jest.fn(),
};

describe('Billing Invoices Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  });

  it('invoices endpoint returns correct DTO', async () => {
    const shopId = 'shop_123';
    const stripeCustomerId = 'cus_123';

    mockPrisma.shop.findUnique.mockResolvedValue({
      id: shopId,
      stripeCustomerId,
    });

    const mockInvoices = [
      {
        id: 'in_123',
        number: 'INV-001',
        status: 'paid',
        amount_paid: 2999,
        total: 2999,
        currency: 'eur',
        created: 1735689600,
        hosted_invoice_url: 'https://invoice.stripe.com/i/in_123',
        invoice_pdf: 'https://invoice.stripe.com/pdf/in_123',
      },
      {
        id: 'in_456',
        number: 'INV-002',
        status: 'open',
        amount_paid: 0,
        total: 4999,
        currency: 'eur',
        created: 1735776000,
        hosted_invoice_url: 'https://invoice.stripe.com/i/in_456',
        invoice_pdf: 'https://invoice.stripe.com/pdf/in_456',
      },
    ];

    mockInvoicesService.listInvoices.mockResolvedValue({
      invoices: mockInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.number,
        status: inv.status,
        total: inv.total / 100, // Convert from cents
        currency: inv.currency.toUpperCase(),
        issuedAt: new Date(inv.created * 1000),
        hostedInvoiceUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf,
      })),
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    // Mock getStoreId
    jest.unstable_mockModule('../../middlewares/store-resolution.js', () => ({
      getStoreId: () => shopId,
    }));

    // Mock services
    jest.unstable_mockModule('../../services/invoices.js', () => mockInvoicesService);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));

    // Mock sendPaginated to return the expected structure
    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendPaginated: (res, items, pagination, meta) => {
        return res.json({
          success: true,
          data: items,
          pagination,
          ...meta,
        });
      },
      sendSuccess: (res, data) => res.json({ success: true, data }),
      sendError: (res, error) => res.status(400).json({ success: false, error }),
    }));

    const { getInvoices } = await import('../../controllers/billing.js');

    const req = {
      query: {},
      ctx: { store: { id: shopId } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await getInvoices(req, res, next);

    // Verify invoices service was called
    expect(mockInvoicesService.listInvoices).toHaveBeenCalledWith(shopId, expect.any(Object));

    // Verify response structure
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    // sendPaginated returns { success, data: items, pagination, ...meta }
    expect(Array.isArray(responseData.data)).toBe(true);
    expect(responseData.data.length).toBe(2);
    expect(responseData.pagination).toBeDefined();

    // Verify first invoice DTO structure
    const firstInvoice = responseData.data[0];
    expect(firstInvoice).toHaveProperty('id');
    expect(firstInvoice).toHaveProperty('invoiceNumber');
    expect(firstInvoice).toHaveProperty('status');
    expect(firstInvoice).toHaveProperty('total');
    expect(firstInvoice).toHaveProperty('currency');
    expect(firstInvoice).toHaveProperty('issuedAt');
    expect(firstInvoice).toHaveProperty('hostedInvoiceUrl');
    expect(firstInvoice).toHaveProperty('pdfUrl');

    // Verify values
    expect(firstInvoice.id).toBe('in_123');
    expect(firstInvoice.invoiceNumber).toBe('INV-001');
    expect(firstInvoice.status).toBe('paid');
    expect(firstInvoice.total).toBe(29.99); // Converted from cents
    expect(firstInvoice.currency).toBe('EUR');
    expect(firstInvoice.hostedInvoiceUrl).toBe('https://invoice.stripe.com/i/in_123');
    expect(firstInvoice.pdfUrl).toBe('https://invoice.stripe.com/pdf/in_123');
  });

  it('handles empty invoices list', async () => {
    const shopId = 'shop_123';

    mockPrisma.shop.findUnique.mockResolvedValue({
      id: shopId,
      stripeCustomerId: 'cus_123',
    });

    mockInvoicesService.listInvoices.mockResolvedValue({
      invoices: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    // Mock getStoreId
    jest.unstable_mockModule('../../middlewares/store-resolution.js', () => ({
      getStoreId: () => shopId,
    }));

    // Mock services
    jest.unstable_mockModule('../../services/invoices.js', () => mockInvoicesService);
    jest.unstable_mockModule('../../services/prisma.js', () => ({ default: mockPrisma }));

    // Mock sendPaginated to return the expected structure
    jest.unstable_mockModule('../../utils/response.js', () => ({
      sendPaginated: (res, items, pagination, meta) => {
        return res.json({
          success: true,
          data: items,
          pagination,
          ...meta,
        });
      },
      sendSuccess: (res, data) => res.json({ success: true, data }),
      sendError: (res, error) => res.status(400).json({ success: false, error }),
    }));

    const { getInvoices } = await import('../../controllers/billing.js');

    const req = {
      query: {},
      ctx: { store: { id: shopId } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await getInvoices(req, res, next);

    // Verify response is empty array
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.success).toBe(true);
    // sendPaginated returns { success, data: items, pagination, ...meta }
    expect(Array.isArray(responseData.data)).toBe(true);
    expect(responseData.data.length).toBe(0);
    expect(responseData.pagination).toBeDefined();
  });
});

