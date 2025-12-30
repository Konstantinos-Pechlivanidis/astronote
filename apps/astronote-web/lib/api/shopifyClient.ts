import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_SHOPIFY_API_BASE_URL || 'http://localhost:3000';

export interface ShopifyTokenExchangeRequest {
  sessionToken: string
}

export interface ShopifyTokenExchangeResponse {
  token: string
  store: {
    id: string
    shopDomain: string
  }
  expiresIn: string
}

export interface ShopifyBalanceResponse {
  balance: number
  reserved: number
  available: number
}

export interface ShopifyPackage {
  id: string
  type: string
  credits: number
  price: number
  currency: string
}

export interface ShopifyTransaction {
  id: string
  type: string
  amount: number
  credits: number
  status: string
  createdAt: string
}

class ShopifyClient {
  private client: AxiosInstance;
  private shopDomain: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token and shop domain
    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      const shop = this.getShopDomain();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      if (shop) {
        config.headers['X-Shopify-Shop-Domain'] = shop;
      }
      return config;
    });

    // Response interceptor for errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearTokens();
          // Redirect to shopify connect
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/shopify/connect';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('shopify_access_token');
  }

  private setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('shopify_access_token', token);
  }

  private getShopDomain(): string | null {
    if (typeof window === 'undefined') return null;
    return this.shopDomain || localStorage.getItem('shopify_shop_domain');
  }

  private setShopDomain(domain: string): void {
    if (typeof window === 'undefined') return;
    this.shopDomain = domain;
    localStorage.setItem('shopify_shop_domain', domain);
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('shopify_access_token');
    localStorage.removeItem('shopify_shop_domain');
    this.shopDomain = null;
  }

  // Auth methods
  async exchangeToken(sessionToken: string): Promise<ShopifyTokenExchangeResponse> {
    const response = await this.client.post<ShopifyTokenExchangeResponse>(
      '/auth/shopify-token',
      { sessionToken },
    );
    if (response.data.token) {
      this.setAccessToken(response.data.token);
      this.setShopDomain(response.data.store.shopDomain);
    }
    return response.data;
  }

  async initiateOAuth(shop: string): Promise<{ authUrl: string }> {
    const response = await this.client.get<{ authUrl: string }>('/auth/shopify', {
      params: { shop },
    });
    return response.data;
  }

  // Billing methods
  async getBalance(): Promise<ShopifyBalanceResponse> {
    const response = await this.client.get<ShopifyBalanceResponse>('/billing/balance');
    return response.data;
  }

  async getPackages(currency = 'EUR'): Promise<ShopifyPackage[]> {
    const response = await this.client.get<{ packages: ShopifyPackage[] }>('/billing/packages', {
      params: { currency },
    });
    return response.data.packages || [];
  }

  async getHistory(params?: { page?: number; limit?: number; type?: string }): Promise<{
    transactions: ShopifyTransaction[]
    pagination: {
      page: number
      limit: number
      total: number
    }
  }> {
    const response = await this.client.get('/billing/history', { params });
    return response.data;
  }

  async purchasePackage(packageId: string, currency = 'EUR'): Promise<{ sessionId?: string; url?: string; checkoutUrl?: string }> {
    const response = await this.client.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      '/billing/purchase',
      { packageId, currency },
    );
    // Handle both response formats
    if (response.data.checkoutUrl) {
      return { url: response.data.checkoutUrl, checkoutUrl: response.data.checkoutUrl };
    }
    return response.data;
  }

  async topupCredits(credits: number, currency = 'EUR'): Promise<{ sessionId: string; url: string }> {
    const response = await this.client.post<{ sessionId: string; url: string }>(
      '/billing/topup',
      { credits, currency },
    );
    return response.data;
  }

  // Subscription methods
  async getSubscriptionStatus(): Promise<{
    status: string
    planType: string
    subscriptionId?: string
  }> {
    const response = await this.client.get('/subscriptions/status');
    return response.data;
  }

  async subscribe(planType: string): Promise<{ sessionId?: string; url?: string; checkoutUrl?: string }> {
    const response = await this.client.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      '/subscriptions/subscribe',
      { planType },
    );
    // Handle both response formats
    if (response.data.checkoutUrl) {
      return { url: response.data.checkoutUrl, checkoutUrl: response.data.checkoutUrl };
    }
    return response.data;
  }

  async cancelSubscription(): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>('/subscriptions/cancel');
    return response.data;
  }

  async getCustomerPortal(): Promise<{ url: string }> {
    const response = await this.client.get<{ url: string }>('/subscriptions/portal');
    return response.data;
  }
}

export const shopifyClient = new ShopifyClient();

