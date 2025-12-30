import api from '../axios';
import { endpoints } from '../endpoints';

/**
 * Normalize billing balance/wallet response to consistent shape
 * Backend returns: { balance: number, subscription: {...} }
 * Normalized: { credits: number, subscription: {...} }
 * 
 * Exported for testing
 */
export function normalizeBalanceResponse(data) {
  if (!data) return null;
  
  return {
    credits: data.balance || 0, // Backend returns balance as number
    subscription: data.subscription || { active: false, planType: null },
    // Keep raw data for backward compatibility
    _raw: data,
  };
}

/**
 * Normalize packages response
 * Ensures consistent structure for credit packs and subscription packages
 */
function normalizePackagesResponse(data) {
  if (!Array.isArray(data)) return [];
  
  return data.map(pkg => ({
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
    const res = await api.get(endpoints.billing.balance);
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
    const res = await api.get(endpoints.billing.wallet);
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
    const res = await api.get(endpoints.billing.packages, { params: { currency } });
    return {
      ...res,
      data: normalizePackagesResponse(res.data),
    };
  },

  /**
   * Get transaction history
   */
  getTransactions: (params) => api.get(endpoints.billing.transactions, { params }),

  /**
   * Get purchase history
   */
  getPurchases: (params) => api.get(endpoints.billing.purchases, { params }),

  /**
   * Purchase subscription package
   * Body: { packageId: number, currency?: string }
   */
  purchase: (data) => api.post(endpoints.billing.purchase, data),

  /**
   * Top-up credits using credit pack
   * Body: { packId: string } - packId MUST be string (e.g., 'pack_100')
   */
  topup: (data) => {
    // Ensure packId is string
    const normalizedData = {
      ...data,
      packId: String(data.packId),
    };
    return api.post(endpoints.billing.topup, normalizedData);
  },
};
