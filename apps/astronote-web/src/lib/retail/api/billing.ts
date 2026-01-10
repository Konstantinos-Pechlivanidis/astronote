import api from './axios';
import { endpoints } from './endpoints';

export interface SubscriptionSummary {
  id?: number
  planType?: string | null
  status?: string | null
  active?: boolean
  billingCurrency?: string
  interval?: 'month' | 'year' | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  includedSmsPerPeriod?: number
  usedSmsThisPeriod?: number
  remainingSmsThisPeriod?: number
  lastBillingError?: string | null
}

export interface AllowanceSummary {
  includedPerPeriod: number
  usedThisPeriod: number
  remainingThisPeriod: number
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  interval?: 'month' | 'year' | null
}

export interface BalanceResponse {
  balance: number
  billingCurrency?: string
  subscription?: SubscriptionSummary
  allowance?: AllowanceSummary
}

export interface BillingSummaryResponse {
  credits: { balance: number }
  subscription?: SubscriptionSummary
  allowance?: AllowanceSummary
  billingCurrency?: string
}

export interface Package {
  id: number | string
  type?: 'credit_pack' | 'subscription_package' | 'credit_topup'
  credits?: number
  units?: number
  price: number
  priceCents?: number
  amount?: number
  currency: string
  stripePriceId?: string
  priceId?: string
  available?: boolean
  name?: string
  displayName?: string
  description?: string
  priceEur?: number
  priceUsd?: number
}

export interface Transaction {
  id: number
  type: string
  amount: number
  credits: number
  status: string
  createdAt: string
}

export interface TopupPrice {
  credits: number
  currency: string
  price: number
  priceWithVat: number
  priceCents?: number
  priceCentsWithVat?: number
  vatAmount: number
  priceEur?: number | null
  priceEurWithVat?: number | null
  priceUsd?: number | null
  priceUsdWithVat?: number | null
}

export interface TransactionsResponse {
  items: Transaction[]
  total: number
  page: number
  pageSize: number
}

/**
 * Normalize billing balance/wallet response to consistent shape
 * Backend returns: { balance: number, subscription: {...} }
 * Normalized: { credits: number, subscription: {...} }
 */
export function normalizeBalanceResponse(data: BalanceResponse | null) {
  if (!data) return null;

  return {
    credits: data.balance || 0,
    subscription: data.subscription || { active: false, planType: null },
    allowance: data.allowance || {
      includedPerPeriod: 0,
      usedThisPeriod: 0,
      remainingThisPeriod: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      interval: null,
    },
    billingCurrency: data.billingCurrency || data.subscription?.billingCurrency || 'EUR',
    _raw: data,
  };
}

export function normalizeSummaryResponse(data: BillingSummaryResponse | null) {
  if (!data) return null;

  return {
    credits: data.credits?.balance || 0,
    subscription: data.subscription || { active: false, planType: null },
    allowance: data.allowance || {
      includedPerPeriod: 0,
      usedThisPeriod: 0,
      remainingThisPeriod: 0,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      interval: null,
    },
    billingCurrency: data.billingCurrency || data.subscription?.billingCurrency || 'EUR',
    _raw: data,
  };
}

/**
 * Normalize packages response
 * Ensures consistent structure for credit packs and subscription packages
 */
function normalizePackagesResponse(data: Package[]): Package[] {
  if (!Array.isArray(data)) return [];

  return data.map((pkg) => {
    const normalizedType = pkg.type || 'credit_topup';
    return {
      ...pkg,
      type: normalizedType,
      // Ensure packId is always string for credit packs
      id: normalizedType === 'credit_pack' ? String(pkg.id) : pkg.id,
    };
  });
}

export const billingApi = {
  /**
   * Get balance and subscription status
   * Returns normalized: { credits: number, subscription: {...} }
   */
  getBalance: async () => {
    const res = await api.get<BalanceResponse>(endpoints.billing.balance);
    return {
      ...res,
      data: normalizeBalanceResponse(res.data),
    };
  },

  /**
   * Get wallet (alias for balance)
   * Returns normalized: { credits: number, subscription: {...} }
   */
  getWallet: async () => {
    const res = await api.get<BalanceResponse>(endpoints.billing.wallet);
    return {
      ...res,
      data: normalizeBalanceResponse(res.data),
    };
  },

  /**
   * Get billing summary (subscription + allowance + credits)
   */
  getSummary: async () => {
    const res = await api.get<BillingSummaryResponse>(endpoints.billing.summary);
    return {
      ...res,
      data: normalizeSummaryResponse(res.data),
    };
  },

  /**
   * Get available packages (credit packs + subscription packages)
   * Returns normalized array with consistent ID types
   */
  getPackages: async (currency = 'EUR') => {
    const res = await api.get<Package[]>(endpoints.billing.packages, { params: { currency } });
    return {
      ...res,
      data: normalizePackagesResponse(res.data),
    };
  },

  /**
   * Get transaction history
   */
  getTransactions: (params?: { page?: number; pageSize?: number }) =>
    api.get<TransactionsResponse>(endpoints.billing.transactions, { params }),

  /**
   * Get purchase history
   */
  getPurchases: (params?: { page?: number; pageSize?: number }) =>
    api.get(endpoints.billing.purchases, { params }),

  /**
   * Purchase subscription package
   * Body: { packageId: number, currency?: string }
   */
  purchase: (data: { packageId: number; currency?: string; idempotencyKey?: string }) => {
    const { idempotencyKey, ...payload } = data;
    return api.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      endpoints.billing.purchase,
      payload,
      {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      },
    );
  },

  /**
   * Calculate top-up price
   */
  calculateTopup: (credits: number, currency?: string) =>
    api.get<TopupPrice>(endpoints.billing.topupCalculate, { params: { credits, currency } }),

  /**
   * Top-up credits
   * Body: { credits: number }
   */
  topup: (data: { credits: number; currency?: string }) => {
    return api.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      endpoints.billing.topup,
      data,
    );
  },
};
