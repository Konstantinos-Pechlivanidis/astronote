import shopifyApi from './axios';
/**
 * Billing Type Definitions
 */
export interface Balance {
  credits: number;
  balance: number; // Alias for credits
  currency?: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  description?: string;
}

export interface PackagesResponse {
  packages: CreditPackage[];
  currency: string;
  subscriptionRequired?: boolean;
}

export interface TopupPrice {
  credits: number;
  price: number;
  currency: string;
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

export interface CheckoutSessionResponse {
  sessionUrl?: string;
  checkoutUrl?: string;
  sessionId?: string;
}

/**
 * Billing API Functions
 */
export const billingApi = {
  /**
   * Get credit balance
   */
  getBalance: async (): Promise<Balance> => {
    const response = await shopifyApi.get<Balance>('/billing/balance');
    // Response interceptor already extracts data
    return response as unknown as Balance;
  },

  /**
   * Get available credit packages
   */
  getPackages: async (currency?: string): Promise<PackagesResponse> => {
    const params = currency ? { currency } : {};
    const response = await shopifyApi.get<PackagesResponse>('/billing/packages', { params });
    // Response interceptor already extracts data
    return response as unknown as PackagesResponse;
  },

  /**
   * Calculate top-up price
   */
  calculateTopup: async (credits: number): Promise<TopupPrice> => {
    const response = await shopifyApi.get<TopupPrice>('/billing/topup/calculate', {
      params: { credits },
    });
    // Response interceptor already extracts data
    return response as unknown as TopupPrice;
  },

  /**
   * Create top-up checkout session
   */
  createTopup: async (data: CreateTopupRequest): Promise<CheckoutSessionResponse> => {
    const response = await shopifyApi.post<CheckoutSessionResponse>('/billing/topup', data);
    // Response interceptor already extracts data
    return response as unknown as CheckoutSessionResponse;
  },

  /**
   * Create purchase checkout session (credit packs)
   */
  createPurchase: async (data: CreatePurchaseRequest): Promise<CheckoutSessionResponse> => {
    const response = await shopifyApi.post<CheckoutSessionResponse>('/billing/purchase', data);
    // Response interceptor already extracts data
    return response as unknown as CheckoutSessionResponse;
  },

  /**
   * Get transaction history
   */
  getHistory: async (params: { page?: number; pageSize?: number }): Promise<TransactionHistoryResponse> => {
    const response = await shopifyApi.get<TransactionHistoryResponse>('/billing/history', { params });
    // Response interceptor already extracts data
    return response as unknown as TransactionHistoryResponse;
  },

  /**
   * Get billing history (Stripe transactions)
   */
  getBillingHistory: async (params: { page?: number; pageSize?: number }): Promise<TransactionHistoryResponse> => {
    const response = await shopifyApi.get<TransactionHistoryResponse>('/billing/billing-history', { params });
    // Response interceptor already extracts data
    return response as unknown as TransactionHistoryResponse;
  },
};

/**
 * Subscription Type Definitions
 */
export type SubscriptionPlanType = 'starter' | 'pro';

export interface SubscriptionStatus {
  active: boolean;
  planType: SubscriptionPlanType | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscribeRequest {
  planType: SubscriptionPlanType;
}

export interface UpdateSubscriptionRequest {
  planType: SubscriptionPlanType;
}

export interface SubscriptionCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
  planType: SubscriptionPlanType;
}

export interface PortalResponse {
  portalUrl: string;
}

/**
 * Subscriptions API Functions
 */
export const subscriptionsApi = {
  /**
   * Get subscription status
   */
  getStatus: async (): Promise<SubscriptionStatus> => {
    const response = await shopifyApi.get<SubscriptionStatus>('/subscriptions/status');
    // Response interceptor already extracts data
    return response as unknown as SubscriptionStatus;
  },

  /**
   * Subscribe to a plan
   */
  subscribe: async (data: SubscribeRequest): Promise<SubscriptionCheckoutResponse> => {
    const response = await shopifyApi.post<SubscriptionCheckoutResponse>('/subscriptions/subscribe', data);
    // Response interceptor already extracts data
    return response as unknown as SubscriptionCheckoutResponse;
  },

  /**
   * Update subscription plan
   */
  update: async (data: UpdateSubscriptionRequest): Promise<SubscriptionStatus> => {
    const response = await shopifyApi.post<SubscriptionStatus>('/subscriptions/update', data);
    // Response interceptor already extracts data
    return response as unknown as SubscriptionStatus;
  },

  /**
   * Cancel subscription
   */
  cancel: async (): Promise<void> => {
    await shopifyApi.post('/subscriptions/cancel');
  },

  /**
   * Get Stripe Customer Portal URL
   */
  getPortal: async (): Promise<PortalResponse> => {
    const response = await shopifyApi.get<PortalResponse>('/subscriptions/portal');
    // Response interceptor already extracts data
    return response as unknown as PortalResponse;
  },
};

