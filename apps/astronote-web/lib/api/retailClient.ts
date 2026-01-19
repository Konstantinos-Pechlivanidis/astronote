import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = (process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '').replace(/\/api$/i, '');

export interface RetailAuthResponse {
  accessToken: string
  user: {
    id: number
    email: string
    senderName?: string
    company?: string
  }
}

export interface RetailRegisterRequest {
  email: string
  password: string
  senderName?: string
  company?: string
}

export interface RetailLoginRequest {
  email: string
  password: string
}

export interface RetailBalanceResponse {
  balance: number
  subscription?: {
    id: number
    planType: string
    status: string
  }
}

export interface RetailPackage {
  id: number
  type: string
  credits: number
  price: number
  currency: string
}

export interface RetailTransaction {
  id: number
  type: string
  amount: number
  credits: number
  status: string
  createdAt: string
}

class RetailClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // For refresh token cookie
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          try {
            await this.refreshToken();
            // Retry original request
            const token = this.getAccessToken();
            if (token && error.config) {
              error.config.headers.Authorization = `Bearer ${token}`;
              return this.client.request(error.config);
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens
            this.clearTokens();
            window.location.href = '/auth/retail/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('retail_access_token');
  }

  private setAccessToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('retail_access_token', token);
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('retail_access_token');
  }

  // Auth methods
  async register(data: RetailRegisterRequest): Promise<RetailAuthResponse> {
    const response = await this.client.post<RetailAuthResponse>('/api/auth/register', data);
    if (response.data.accessToken) {
      this.setAccessToken(response.data.accessToken);
    }
    return response.data;
  }

  async login(data: RetailLoginRequest): Promise<RetailAuthResponse> {
    const response = await this.client.post<RetailAuthResponse>('/api/auth/login', data);
    if (response.data.accessToken) {
      this.setAccessToken(response.data.accessToken);
    }
    return response.data;
  }

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await this.client.post<{ accessToken: string }>('/api/auth/refresh');
    if (response.data.accessToken) {
      this.setAccessToken(response.data.accessToken);
    }
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/api/auth/logout');
    this.clearTokens();
  }

  // Billing methods
  async getBalance(): Promise<RetailBalanceResponse> {
    const response = await this.client.get<RetailBalanceResponse>('/api/billing/balance');
    return response.data;
  }

  async getPackages(currency = 'EUR'): Promise<RetailPackage[]> {
    const response = await this.client.get<RetailPackage[]>('/api/billing/packages', {
      params: { currency },
    });
    return response.data;
  }

  async getTransactions(params?: { page?: number; pageSize?: number }): Promise<{
    items: RetailTransaction[]
    total: number
    page: number
    pageSize: number
  }> {
    const response = await this.client.get('/api/billing/transactions', { params });
    return response.data;
  }

  async purchasePackage(packageId: number): Promise<{ sessionId?: string; url?: string; checkoutUrl?: string }> {
    const response = await this.client.post<{ sessionId?: string; url?: string; checkoutUrl?: string; ok?: boolean }>(
      '/api/billing/purchase',
      { packageId },
    );
    // Handle both response formats
    if (response.data.checkoutUrl) {
      return { url: response.data.checkoutUrl, checkoutUrl: response.data.checkoutUrl };
    }
    return response.data;
  }

  async topupCredits(credits: number): Promise<{ sessionId: string; url: string }> {
    const response = await this.client.post<{ sessionId: string; url: string }>(
      '/api/billing/topup',
      { credits },
    );
    return response.data;
  }

  // Subscription methods
  async getCurrentSubscription(): Promise<any> {
    const response = await this.client.get('/api/subscriptions/current');
    return response.data;
  }

  async subscribe(planType: string): Promise<{ sessionId?: string; url?: string; checkoutUrl?: string }> {
    const response = await this.client.post<{ sessionId?: string; url?: string; checkoutUrl?: string; ok?: boolean }>(
      '/api/subscriptions/subscribe',
      { planType },
    );
    // Handle both response formats
    if (response.data.checkoutUrl) {
      return { url: response.data.checkoutUrl, checkoutUrl: response.data.checkoutUrl };
    }
    return response.data;
  }

  async cancelSubscription(): Promise<{ success: boolean }> {
    const response = await this.client.post<{ success: boolean }>('/api/subscriptions/cancel');
    return response.data;
  }
}

export const retailClient = new RetailClient();
