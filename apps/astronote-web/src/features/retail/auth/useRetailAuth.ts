'use client';

import { useState, useEffect, useCallback } from 'react';
import { authApi, type AuthResponse } from '@/src/lib/retail/api/auth';
import { meApi } from '@/src/lib/retail/api/me';

export interface RetailUser {
  id: number
  email: string
  senderName?: string
  company?: string
  timezone?: string
}

interface UseRetailAuthReturn {
  user: RetailUser | null
  loading: boolean
  login: (_email: string, _password: string) => Promise<AuthResponse>
  signup: (_email: string, _password: string, _senderName?: string, _company?: string) => Promise<AuthResponse>
  logout: () => Promise<void>
}

export function useRetailAuth(): UseRetailAuthReturn {
  const [user, setUser] = useState<RetailUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 5000); // Max 5 seconds for auth check

      // Verify token by fetching /api/me
      meApi
        .get()
        .then((res) => {
          clearTimeout(timeout);
          setUser(res.data.user);
          setLoading(false);
        })
        .catch((error: any) => {
          clearTimeout(timeout);
          // If 401, token is invalid - clear it
          if (error?.response?.status === 401) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              // Show toast if available
              if ((window as any).toast) {
                (window as any).toast.error('Session expired. Please log in again.');
              }
            }
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResponse> => {
    const res = await authApi.login({ email, password });
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', res.data.accessToken);
    }
    setUser(res.data.user);
    return res.data;
  }, []);

  const signup = useCallback(
    async (
      email: string,
      password: string,
      senderName?: string,
      company?: string,
    ): Promise<AuthResponse> => {
      const res = await authApi.register({ email, password, senderName, company });
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', res.data.accessToken);
      }
      setUser(res.data.user);
      return res.data;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout API call failed:', error);
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
    setUser(null);
  }, []);

  return {
    user,
    loading,
    login,
    signup,
    logout,
  };
}

