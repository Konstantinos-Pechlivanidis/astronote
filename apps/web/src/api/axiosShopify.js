import axios from 'axios';
import { store } from '@/store/store';
import { toast } from 'sonner';

const baseURL = import.meta.env.VITE_SHOPIFY_API_BASE_URL || 'http://localhost:3000';

const axiosShopify = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
axiosShopify.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.shopifyToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle 401
axiosShopify.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to shopify login
      store.dispatch({ type: 'auth/clearShopifyToken' });
      toast.error('Session expired. Please log in again.');
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/shopify/login')) {
        window.location.href = '/shopify/login';
      }
    }
    return Promise.reject(error);
  },
);

export default axiosShopify;

