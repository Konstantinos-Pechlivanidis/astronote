import api from './axios';
import { endpoints } from './endpoints';

export interface BalanceResponse {
  balance: number
  subscription?: {
    id: number
    planType: string
    status: string
    active: boolean
  }
}

export interface Package {
  id: number | string
  type: 'credit_pack' | 'subscription_package'
  credits?: number
  price: number
  currency: string
  name?: string
  description?: string
}

export interface Transaction {
  id: number
  type: string
  amount: number
  credits: number
  status: string
  createdAt: string
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
    _raw: data,
  };
}

/**
 * Normalize packages response
 * Ensures consistent structure for credit packs and subscription packages
 */
function normalizePackagesResponse(data: Package[]): Package[] {
  if (!Array.isArray(data)) return [];

  return data.map((pkg) => ({
    ...pkg,
    // Ensure packId is always string for credit packs
    id: pkg.type === 'credit_pack' ? String(pkg.id) : pkg.id,
  }));
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
  purchase: (data: { packageId: number; currency?: string }) =>
    api.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      endpoints.billing.purchase,
      data,
    ),

  /**
   * Top-up credits using credit pack
   * Body: { packId: string } - packId MUST be string (e.g., 'pack_100')
   */
  topup: (data: { packId: string | number }) => {
    // Ensure packId is string
    const normalizedData = {
      ...data,
      packId: String(data.packId),
    };
    return api.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      endpoints.billing.topup,
      normalizedData,
    );
  },
};

