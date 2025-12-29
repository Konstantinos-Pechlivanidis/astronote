import axios from 'axios';
import { store } from '@/store/store';

const baseURL = import.meta.env.VITE_SHOPIFY_API_BASE_URL || 'http://localhost:3001';

const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
axiosClient.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token;
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
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to settings/login
      store.dispatch({ type: 'auth/clearToken' });
      window.location.href = '/settings';
    }
    return Promise.reject(error);
  },
);

export default axiosClient;

