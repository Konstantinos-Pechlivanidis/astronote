import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { SHOPIFY_API_BASE_URL } from '../config';
import { resolveShopDomain } from './shop-domain';

/**
 * Shopify API Axios Instance
 * Configured with auth interceptors for JWT token and shop domain
 *
 * IMPORTANT: All Shopify API calls MUST use this instance to ensure:
 * - Authorization header is always present
 * - X-Shopify-Shop-Domain header is always present
 */

const shopifyApi: AxiosInstance = axios.create({
  baseURL: SHOPIFY_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - add auth token and shop domain
shopifyApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window === 'undefined') {
      return config;
    }

    // Get JWT token from localStorage
    const token = localStorage.getItem('shopify_token');
    if (!token) {
      // No token - this should trigger re-auth
      const error = new Error('Missing shopify_token. Please re-authenticate.');
      (error as any).code = 'MISSING_TOKEN';
      return Promise.reject(error);
    }

    // Always attach Authorization header
    config.headers.Authorization = `Bearer ${token}`;

    // Resolve shop domain using reliable source of truth
    const shopDomain = resolveShopDomain();

    if (!shopDomain) {
      // Shop domain is required - do not make the request
      const error = new Error('Missing shop domain. Please re-authenticate.');
      (error as any).code = 'MISSING_SHOP_DOMAIN';

      // Clear invalid state
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');

      // DEV-only: Log warning
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('[Shopify API] Missing shop domain. Request blocked:', config.url);
      }

      // Trigger re-auth flow
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/app/shopify/auth/login') && !currentPath.includes('/app/shopify/auth/callback')) {
        window.location.href = '/app/shopify/auth/login';
      }

      return Promise.reject(error);
    }

    // Always attach X-Shopify-Shop-Domain header
    config.headers['X-Shopify-Shop-Domain'] = shopDomain;

    // DEV-only: Guard to detect missing header early
    if (process.env.NODE_ENV === 'development') {
      const isShopifyPage = window.location.pathname.includes('/app/shopify');
      if (isShopifyPage && !config.headers['X-Shopify-Shop-Domain']) {
        // eslint-disable-next-line no-console
        console.warn('[Shopify API] WARNING: Request to', config.url, 'missing X-Shopify-Shop-Domain header');
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle errors
shopifyApi.interceptors.response.use(
  (response) => {
    // Backend returns { success: true, data: {...} }
    // Extract data for easier access
    if (response.data?.success && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  async (error: AxiosError) => {
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    const errorData = error.response?.data as any;
    const errorCode = errorData?.code;

    // Handle INVALID_SHOP_DOMAIN error
    if (errorCode === 'INVALID_SHOP_DOMAIN' || errorData?.error === 'Invalid shop domain') {
      // Clear invalid state
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');

      // DEV-only: Log warning
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[Shopify API] INVALID_SHOP_DOMAIN error. Clearing auth state and redirecting to login.');
      }

      // Redirect to login if not already there
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/app/shopify/auth/login') && !currentPath.includes('/app/shopify/auth/callback')) {
        window.location.href = '/app/shopify/auth/login';
      }

      return Promise.reject(error);
    }

    // Handle 401 - token expired or invalid
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');

      // Redirect to login if not already there
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/app/shopify/auth/login') && !currentPath.includes('/app/shopify/auth/callback')) {
        window.location.href = '/app/shopify/auth/login';
      }
    }

    return Promise.reject(error);
  },
);

export default shopifyApi;

