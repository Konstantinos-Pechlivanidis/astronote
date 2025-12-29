import axios from 'axios';
import { store } from '@/store/store';
import { toast } from 'sonner';

const baseURL = import.meta.env.VITE_RETAIL_API_BASE_URL || 'http://localhost:3001';

const axiosRetail = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
axiosRetail.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.retailToken;
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
axiosRetail.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to retail login
      store.dispatch({ type: 'auth/clearRetailToken' });
      toast.error('Session expired. Please log in again.');
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/retail/login')) {
        window.location.href = '/retail/login';
      }
    }
    return Promise.reject(error);
  },
);

export default axiosRetail;

