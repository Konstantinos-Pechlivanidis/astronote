import axios from 'axios';
import { endpoints } from './endpoints';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  withCredentials: true, // Send cookies for refresh token
});

// Request interceptor: Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('[Axios] Request:', config.method?.toUpperCase(), config.url, {
      baseURL: config.baseURL,
      data: config.data,
      headers: config.headers,
    });
  }
  return config;
});

// Response interceptor: Handle 401 and refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('[Axios] Response:', response.config.method?.toUpperCase(), response.config.url, {
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  async (error) => {
    // Always log errors to console for debugging
    console.error('=== AXIOS ERROR ===');
    console.error('Method:', error.config?.method?.toUpperCase());
    console.error('URL:', error.config?.url);
    console.error('Full URL:', error.config?.baseURL + error.config?.url);
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Response Data:', error.response?.data);
    console.error('Request Data:', error.config?.data);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('==================');
    const originalRequest = error.config;

    // Don't auto-refresh token for auth endpoints (login, register, refresh)
    // These should handle their own errors without redirecting
    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                          requestUrl.includes('/auth/register') ||
                          requestUrl.includes('/auth/refresh') ||
                          requestUrl.includes('/api/auth/login') ||
                          requestUrl.includes('/api/auth/register') ||
                          requestUrl.includes('/api/auth/refresh');
    
    if (import.meta.env.DEV) {
      console.log('[Axios Interceptor] 401 error - isAuthEndpoint:', isAuthEndpoint, 'URL:', requestUrl);
    }
    
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            // Preserve all original headers (including Idempotency-Key) and update Authorization
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${token}`,
            };
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${endpoints.auth.refresh}`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        processQueue(null, accessToken);
        // Preserve all original headers (including Idempotency-Key) and update Authorization
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${accessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        // Only redirect if not already on login/register page and not an auth endpoint
        const currentPath = window.location.pathname;
        const isOnAuthPage = currentPath === '/login' || currentPath === '/signup';
        const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || 
                              originalRequest?.url?.includes('/auth/register') ||
                              originalRequest?.url?.includes('/auth/refresh');
        
        if (!isOnAuthPage && !isAuthEndpoint) {
          // Add delay to allow error to be displayed before redirect
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

