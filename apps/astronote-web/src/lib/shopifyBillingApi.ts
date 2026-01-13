import { z } from 'zod';
import shopifyApi from './shopify/api/axios';

export type BillingApiError = {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  status?: number;
};

const normalizeBillingError = (
  error: unknown,
  fallbackMessage: string,
): BillingApiError => {
  const err = error as any;
  const responseData = err?.response?.data;

  return {
    success: false,
    code:
      err?.code ||
      responseData?.code ||
      responseData?.error ||
      'UNKNOWN_ERROR',
    message: responseData?.message || err?.message || fallbackMessage,
    requestId: responseData?.requestId || err?.requestId,
    status: err?.response?.status,
  };
};

const safeRequest = async <T>(
  action: () => Promise<T>,
  fallbackMessage: string,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw normalizeBillingError(error, fallbackMessage);
  }
};

export type SubscriptionPlanType = 'starter' | 'pro';
export type SubscriptionStatusCode =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'paused'
  | 'inactive'
  | 'cancelled';

export interface SubscriptionStatus {
  active: boolean;
  planType: SubscriptionPlanType | null;
  planCode?: string | null;
  status: SubscriptionStatusCode;
  interval?: 'month' | 'year' | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  includedSmsPerPeriod?: number;
  usedSmsThisPeriod?: number;
  remainingSmsThisPeriod?: number;
  billingCurrency?: string;
  currency?: string | null;
  lastBillingError?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  pendingChange?: {
    planCode?: string | null;
    interval?: 'month' | 'year' | null;
    currency?: string | null;
    effectiveAt?: string | null;
  } | null;
  derivedFrom?: string | null;
  mismatchDetected?: boolean;
  lastSyncedAt?: string | null;
  sourceOfTruth?: string | null;
}

export interface BillingSummary {
  subscription: SubscriptionStatus;
  allowance: {
    includedPerPeriod: number;
    usedThisPeriod: number;
    remainingThisPeriod: number;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    interval?: 'month' | 'year' | null;
  };
  credits: {
    balance: number;
    currency: string;
  };
  billingCurrency?: string;
}

export interface Balance {
  credits: number;
  balance: number;
  currency?: string;
  subscription?: SubscriptionStatus;
}

export interface CreditPackage {
  id: string;
  name: string;
  displayName?: string;
  units?: number;
  credits: number;
  price: number;
  amount?: number;
  currency: string;
  priceId?: string;
  stripePriceId?: string;
  available?: boolean;
  type?: string;
  description?: string;
}

export interface PackagesResponse {
  packages: CreditPackage[];
  currency: string;
  subscriptionRequired?: boolean;
}

export interface TopupPrice {
  credits: number;
  currency: string;
  basePrice?: number;
  taxRate?: number;
  taxAmount?: number;
  totalPrice?: number;
  taxTreatment?: string;
  taxJurisdiction?: string;
  price?: number;
  priceEur?: number;
  priceEurWithVat?: number;
  vatAmount?: number;
}

export interface Transaction {
  id: string;
  type: 'credit_purchase' | 'topup' | 'subscription' | 'refund';
  amount: number;
  currency: string;
  credits?: number;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  description?: string;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface BillingProfile {
  shopId?: string;
  legalName?: string | null;
  vatNumber?: string | null;
  vatCountry?: string | null;
  billingEmail?: string | null;
  billingAddress?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  currency?: string;
  taxStatus?: string | null;
  taxExempt?: boolean;
  isBusiness?: boolean;
  vatValidated?: boolean | null;
  validatedAt?: string | null;
  validationSource?: string | null;
  taxTreatment?: string | null;
}

export interface InvoiceRecord {
  id: string;
  stripeInvoiceId: string;
  invoiceNumber?: string | null;
  subtotal?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
  pdfUrl?: string | null;
  hostedInvoiceUrl?: string | null;
  status?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
}

export interface InvoicesResponse {
  invoices: InvoiceRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreatePurchaseRequest {
  packageId: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}

export interface CreateTopupRequest {
  credits: number;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}

export interface UpdateBillingProfileRequest {
  legalName?: string | null;
  vatNumber?: string | null;
  vatCountry?: string | null;
  billingEmail?: string | null;
  billingAddress?: BillingProfile['billingAddress'];
  currency?: string;
  isBusiness?: boolean | null;
  taxTreatment?: string | null;
}

export interface CheckoutSessionResponse {
  sessionUrl?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export interface SubscribeRequest {
  planType: SubscriptionPlanType;
  interval?: 'month' | 'year';
  currency?: string;
}

export interface UpdateSubscriptionRequest {
  planType: SubscriptionPlanType;
  interval?: 'month' | 'year';
  currency?: string;
  behavior?: 'immediate' | 'period_end';
}

export interface SwitchIntervalRequest {
  interval: 'month' | 'year';
  currency?: string;
}

export interface SubscriptionCheckoutResponse {
  checkoutUrl?: string;
  sessionId?: string;
  planType?: SubscriptionPlanType;
  currency?: string;
}

export interface PortalResponse {
  portalUrl: string;
}

const subscriptionStatusSchema = z
  .object({
    active: z.boolean().optional(),
    planType: z.enum(['starter', 'pro']).nullable().optional(),
    status: z
      .enum([
        'active',
        'trialing',
        'past_due',
        'unpaid',
        'incomplete',
        'paused',
        'inactive',
        'cancelled',
      ])
      .optional(),
    interval: z.enum(['month', 'year']).nullable().optional(),
    currentPeriodStart: z.string().nullable().optional(),
    currentPeriodEnd: z.string().nullable().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    includedSmsPerPeriod: z.number().optional(),
    usedSmsThisPeriod: z.number().optional(),
    remainingSmsThisPeriod: z.number().optional(),
    billingCurrency: z.string().optional(),
    lastBillingError: z.string().nullable().optional(),
    stripeCustomerId: z.string().nullable().optional(),
    stripeSubscriptionId: z.string().nullable().optional(),
  })
  .passthrough();

const billingSummarySchema = z
  .object({
    subscription: subscriptionStatusSchema.optional(),
    allowance: z
      .object({
        includedPerPeriod: z.number().optional(),
        usedThisPeriod: z.number().optional(),
        remainingThisPeriod: z.number().optional(),
        currentPeriodStart: z.string().nullable().optional(),
        currentPeriodEnd: z.string().nullable().optional(),
        interval: z.enum(['month', 'year']).nullable().optional(),
      })
      .optional(),
    credits: z
      .object({
        balance: z.number().optional(),
        currency: z.string().optional(),
      })
      .optional(),
    billingCurrency: z.string().optional(),
  })
  .passthrough();

const billingProfileSchema = z
  .object({
    shopId: z.string().optional(),
    legalName: z.string().nullable().optional(),
    vatNumber: z.string().nullable().optional(),
    vatCountry: z.string().nullable().optional(),
    billingEmail: z.string().nullable().optional(),
    billingAddress: z
      .object({
        line1: z.string().nullable().optional(),
        line2: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        postalCode: z.string().nullable().optional(),
        country: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    currency: z.string().optional(),
    taxStatus: z.string().nullable().optional(),
    taxExempt: z.boolean().optional(),
  })
  .passthrough();

const invoiceRecordSchema = z
  .object({
    id: z.string(),
    stripeInvoiceId: z.string(),
    invoiceNumber: z.string().nullable().optional(),
    subtotal: z.number().nullable().optional(),
    tax: z.number().nullable().optional(),
    total: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    pdfUrl: z.string().nullable().optional(),
    hostedInvoiceUrl: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    issuedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .passthrough();

const invoicesResponseSchema = z
  .object({
    invoices: z.array(invoiceRecordSchema).optional(),
    pagination: z
      .object({
        page: z.number().optional(),
        pageSize: z.number().optional(),
        total: z.number().optional(),
        totalPages: z.number().optional(),
        hasNextPage: z.boolean().optional(),
        hasPrevPage: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

const defaultSummary: BillingSummary = {
  subscription: {
    active: false,
    planType: null,
    status: 'inactive',
  },
  allowance: {
    includedPerPeriod: 0,
    usedThisPeriod: 0,
    remainingThisPeriod: 0,
  },
  credits: {
    balance: 0,
    currency: 'EUR',
  },
  billingCurrency: 'EUR',
};

const parseBillingSummary = (payload: unknown): BillingSummary => {
  const parsed = billingSummarySchema.safeParse(payload);
  if (!parsed.success) {
    return defaultSummary;
  }

  return {
    ...defaultSummary,
    ...parsed.data,
    subscription: {
      ...defaultSummary.subscription,
      ...(parsed.data.subscription || {}),
    },
    allowance: {
      ...defaultSummary.allowance,
      ...(parsed.data.allowance || {}),
    },
    credits: {
      ...defaultSummary.credits,
      ...(parsed.data.credits || {}),
    },
  };
};

const defaultBillingProfile: BillingProfile = {
  currency: 'EUR',
  taxExempt: false,
};

const parseBillingProfile = (payload: unknown): BillingProfile => {
  const parsed = billingProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return defaultBillingProfile;
  }
  return {
    ...defaultBillingProfile,
    ...parsed.data,
  };
};

const defaultInvoicesResponse: InvoicesResponse = {
  invoices: [],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
};

const parseInvoicesResponse = (payload: unknown): InvoicesResponse => {
  const parsed = invoicesResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return defaultInvoicesResponse;
  }
  return {
    invoices: parsed.data.invoices || [],
    pagination: {
      ...defaultInvoicesResponse.pagination,
      ...(parsed.data.pagination || {}),
    },
  };
};

const buildIdempotencyKey = (prefix = 'shopify') => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const shopifyBillingApi = {
  getBillingSummary: async (): Promise<BillingSummary> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<BillingSummary>('/billing/summary');
      return parseBillingSummary(response);
    }, 'Failed to load billing summary'),

  getBalance: async (): Promise<Balance> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<Balance>('/billing/balance');
      return response as unknown as Balance;
    }, 'Failed to load balance'),

  listCreditPackages: async (currency?: string): Promise<PackagesResponse> =>
    safeRequest(async () => {
      const params = currency ? { currency } : {};
      const response = await shopifyApi.get<PackagesResponse>('/billing/packages', { params });
      return response as unknown as PackagesResponse;
    }, 'Failed to load credit packages'),

  getHistory: async (params: { page?: number; pageSize?: number }): Promise<TransactionHistoryResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<TransactionHistoryResponse>('/billing/history', { params });
      return response as unknown as TransactionHistoryResponse;
    }, 'Failed to load billing history'),

  getBillingHistory: async (params: { page?: number; pageSize?: number }): Promise<TransactionHistoryResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<TransactionHistoryResponse>('/billing/billing-history', { params });
      return response as unknown as TransactionHistoryResponse;
    }, 'Failed to load Stripe transactions'),

  calculateTopup: async (credits: number, currency?: string): Promise<TopupPrice> =>
    safeRequest(async () => {
      const params = currency ? { credits, currency } : { credits };
      const response = await shopifyApi.get<TopupPrice>('/billing/topup/calculate', {
        params,
      });
      return response as unknown as TopupPrice;
    }, 'Failed to calculate top-up'),

  createTopup: async (data: CreateTopupRequest): Promise<CheckoutSessionResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<CheckoutSessionResponse>('/billing/topup', data);
      return response as unknown as CheckoutSessionResponse;
    }, 'Failed to create top-up session'),

  createPurchase: async (data: CreatePurchaseRequest): Promise<CheckoutSessionResponse> =>
    safeRequest(async () => {
      const idempotencyKey = buildIdempotencyKey('billing-purchase');
      const response = await shopifyApi.post<CheckoutSessionResponse>(
        '/billing/purchase',
        data,
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
      return response as unknown as CheckoutSessionResponse;
    }, 'Failed to create purchase session'),

  getSubscriptionStatus: async (): Promise<SubscriptionStatus> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<SubscriptionStatus>('/subscriptions/status');
      return response as unknown as SubscriptionStatus;
    }, 'Failed to load subscription status'),

  subscribe: async (data: SubscribeRequest): Promise<SubscriptionCheckoutResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<SubscriptionCheckoutResponse>('/subscriptions/subscribe', data);
      return response as unknown as SubscriptionCheckoutResponse;
    }, 'Failed to initiate subscription'),

  updateSubscription: async (data: UpdateSubscriptionRequest): Promise<SubscriptionStatus> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<SubscriptionStatus>('/subscriptions/update', data);
      return response as unknown as SubscriptionStatus;
    }, 'Failed to update subscription'),

  switchSubscription: async (
    data: SwitchIntervalRequest,
  ): Promise<{ interval?: 'month' | 'year'; planType?: SubscriptionPlanType; alreadyUpdated?: boolean; scheduled?: boolean; effectiveAt?: string; subscription?: SubscriptionStatus }> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<{ interval?: 'month' | 'year'; planType?: SubscriptionPlanType; alreadyUpdated?: boolean; scheduled?: boolean; effectiveAt?: string; subscription?: SubscriptionStatus }>(
        '/subscriptions/switch',
        data,
      );
      return response as unknown as { interval?: 'month' | 'year'; planType?: SubscriptionPlanType; alreadyUpdated?: boolean; scheduled?: boolean; effectiveAt?: string; subscription?: SubscriptionStatus };
    }, 'Failed to switch subscription interval'),

  reconcileSubscription: async (): Promise<{ reconciled: boolean; reason?: string; subscription?: SubscriptionStatus }> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<{ reconciled: boolean; reason?: string; subscription?: SubscriptionStatus }>('/subscriptions/reconcile');
      return response as unknown as { reconciled: boolean; reason?: string; subscription?: SubscriptionStatus };
    }, 'Failed to reconcile subscription'),

  cancelSubscription: async (): Promise<{ cancelledAt?: string; subscription?: SubscriptionStatus }> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<{ cancelledAt?: string; subscription?: SubscriptionStatus }>('/subscriptions/cancel');
      return response as unknown as { cancelledAt?: string; subscription?: SubscriptionStatus };
    }, 'Failed to cancel subscription'),

  resumeSubscription: async (): Promise<{ subscription?: SubscriptionStatus }> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<{ subscription?: SubscriptionStatus }>('/subscriptions/resume');
      return response as unknown as { subscription?: SubscriptionStatus };
    }, 'Failed to resume subscription'),

  getBillingPortalUrl: async (): Promise<PortalResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<PortalResponse>('/subscriptions/portal');
      return response as unknown as PortalResponse;
    }, 'Failed to open billing portal'),

  finalize: async (data: { sessionId: string; type?: string }): Promise<{
    finalized: boolean;
    alreadyActive?: boolean;
    subscription?: SubscriptionStatus;
    creditsAllocated?: boolean;
    credits?: number;
  }> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<{
        finalized: boolean;
        alreadyActive?: boolean;
        subscription?: SubscriptionStatus;
        creditsAllocated?: boolean;
        credits?: number;
      }>('/subscriptions/finalize', data);
      return response as unknown as {
        finalized: boolean;
        alreadyActive?: boolean;
        subscription?: SubscriptionStatus;
        creditsAllocated?: boolean;
        credits?: number;
      };
    }, 'Failed to finalize subscription'),

  getBillingProfile: async (): Promise<BillingProfile> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<BillingProfile>('/billing/profile');
      return parseBillingProfile(response);
    }, 'Failed to load billing profile'),

  updateBillingProfile: async (data: UpdateBillingProfileRequest): Promise<BillingProfile> =>
    safeRequest(async () => {
      const response = await shopifyApi.put<BillingProfile>('/billing/profile', data);
      return parseBillingProfile(response);
    }, 'Failed to update billing profile'),

  syncBillingProfileFromStripe: async (): Promise<BillingProfile> =>
    safeRequest(async () => {
      const response = await shopifyApi.post<BillingProfile>('/billing/profile/sync-from-stripe');
      return parseBillingProfile(response);
    }, 'Failed to sync billing profile from Stripe'),

  getInvoices: async (params: { page?: number; pageSize?: number; status?: string } = {}): Promise<InvoicesResponse> =>
    safeRequest(async () => {
      const response = await shopifyApi.get<InvoicesResponse>('/billing/invoices', { params });
      return parseInvoicesResponse(response);
    }, 'Failed to load invoices'),
};

export const billingApi = {
  getBalance: shopifyBillingApi.getBalance,
  getPackages: shopifyBillingApi.listCreditPackages,
  calculateTopup: shopifyBillingApi.calculateTopup,
  createTopup: shopifyBillingApi.createTopup,
  createPurchase: shopifyBillingApi.createPurchase,
  getHistory: shopifyBillingApi.getHistory,
  getBillingHistory: shopifyBillingApi.getBillingHistory,
  getSummary: shopifyBillingApi.getBillingSummary,
  getProfile: shopifyBillingApi.getBillingProfile,
  updateProfile: shopifyBillingApi.updateBillingProfile,
  syncProfileFromStripe: shopifyBillingApi.syncBillingProfileFromStripe,
  getInvoices: shopifyBillingApi.getInvoices,
};

export const subscriptionsApi = {
  getStatus: shopifyBillingApi.getSubscriptionStatus,
  subscribe: shopifyBillingApi.subscribe,
  update: shopifyBillingApi.updateSubscription,
  cancel: shopifyBillingApi.cancelSubscription,
  resume: shopifyBillingApi.resumeSubscription,
  getPortal: shopifyBillingApi.getBillingPortalUrl,
  switchInterval: shopifyBillingApi.switchSubscription,
  finalize: shopifyBillingApi.finalize,
  reconcile: shopifyBillingApi.reconcileSubscription,
};
