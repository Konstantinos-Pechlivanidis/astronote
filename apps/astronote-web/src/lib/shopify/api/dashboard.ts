import shopifyApi from './axios';

/**
 * Shopify Dashboard API
 * Dashboard KPI endpoints
 */

export interface DashboardKPIs {
  credits?: number; // Fallback, use billing/balance for source of truth
  totalCampaigns: number;
  totalContacts: number;
  totalMessagesSent: number;
  activeAutomations?: number;
  reports?: {
    last7Days: {
      sent: number;
      delivered: number;
      failed: number;
      unsubscribes: number;
    };
    topCampaigns: Array<{
      id: string;
      name: string;
      sent: number;
      delivered: number;
      failed: number;
      createdAt: string;
    }>;
    deliveryRateTrend: Array<{
      date: string;
      deliveredRate: number;
    }>;
    creditsUsage: Array<{
      date: string;
      creditsDebited: number;
    }>;
  };
}

export interface BillingBalance {
  credits: number;
  currency: string;
}

/**
 * Get dashboard KPIs
 * @returns Dashboard KPIs (campaigns, contacts, messages, automations)
 */
export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const response = await shopifyApi.get<DashboardKPIs>('/dashboard');
  // Response interceptor already extracts data
  return response as unknown as DashboardKPIs;
}

/**
 * Get billing balance (source of truth for credits)
 * @returns Credit balance and currency
 */
export async function getBillingBalance(): Promise<BillingBalance> {
  const response = await shopifyApi.get<BillingBalance>('/billing/balance');
  // Response interceptor already extracts data
  return response as unknown as BillingBalance;
}

export const dashboardApi = {
  getKPIs: getDashboardKPIs,
  getBalance: getBillingBalance,
};

