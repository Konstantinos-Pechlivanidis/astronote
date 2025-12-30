import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001';

// Endpoints for auth detection
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
];

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Send cookies for refresh token
});

// Request interceptor: Add auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: Handle 401 and refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (_token: string) => void
  reject: (_error: any) => void
}> = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1; // Prevent infinite refresh loops

const processQueue = (_error: any, _token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (_error) {
      prom.reject(_error);
    } else {
      prom.resolve(_token!);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Don't auto-refresh token for auth endpoints
    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint = AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // Queue the request
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token: string) => {
            // Preserve all original headers (including Idempotency-Key) and update Authorization
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      refreshAttempts++;

      // Safety: Prevent infinite refresh loops
      if (refreshAttempts > MAX_REFRESH_ATTEMPTS) {
        isRefreshing = false;
        refreshAttempts = 0;
        processQueue(new Error('Too many refresh attempts'), null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          window.location.href = '/auth/retail/login';
        }
        return Promise.reject(new Error('Too many refresh attempts'));
      }

      try {
        const response = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const { accessToken } = response.data as { accessToken: string };

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
        }

        refreshAttempts = 0; // Reset on success
        processQueue(null, accessToken);

        // Preserve all original headers (including Idempotency-Key) and update Authorization
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');

          // Only redirect if not already on login/register page and not an auth endpoint
          const currentPath = window.location.pathname;
          const isOnAuthPage = currentPath === '/auth/retail/login' || currentPath === '/auth/retail/register';

          if (!isOnAuthPage && !isAuthEndpoint) {
            // Show toast notification before redirect
            if (typeof window !== 'undefined' && (window as any).toast) {
              (window as any).toast.error('Session expired. Please log in again.');
            }
            // Add delay to allow error to be displayed before redirect
            setTimeout(() => {
              window.location.href = '/auth/retail/login';
            }, 1500);
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        // Reset refresh attempts after a delay to allow retry on next 401
        setTimeout(() => {
          refreshAttempts = 0;
        }, 5000);
      }
    }

    return Promise.reject(error);
  },
);

export default api;

