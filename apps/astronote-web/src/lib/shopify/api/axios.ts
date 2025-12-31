import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { SHOPIFY_API_BASE_URL } from '../config';

/**
 * Shopify API Axios Instance
 * Configured with auth interceptors for JWT token and shop domain
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
    if (typeof window !== 'undefined') {
      // Get JWT token from localStorage
      const token = localStorage.getItem('shopify_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add shop domain header as fallback (from token or localStorage)
      const storeInfo = localStorage.getItem('shopify_store');
      if (storeInfo) {
        try {
          const store = JSON.parse(storeInfo);
          if (store.shopDomain) {
            config.headers['X-Shopify-Shop-Domain'] = store.shopDomain;
          }
        } catch (e) {
          // Silently fail - invalid store info
        }
      }

      // Also try to extract shop domain from token if store info is not available
      if (!config.headers['X-Shopify-Shop-Domain'] && token) {
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.shopDomain) {
              config.headers['X-Shopify-Shop-Domain'] = payload.shopDomain;
            }
          }
        } catch (tokenError) {
          // Silently fail - token parsing is not critical
        }
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
    // Handle 401 - token expired or invalid
    if (error.response?.status === 401) {
      // Clear invalid token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('shopify_token');
        localStorage.removeItem('shopify_store');

        // Redirect to login if not already there
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/app/shopify/auth/login') && !currentPath.includes('/app/shopify/auth/callback')) {
          window.location.href = '/app/shopify/auth/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

export default shopifyApi;

