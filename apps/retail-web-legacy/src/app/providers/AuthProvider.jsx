import { createContext, useContext, useState, useEffect } from 'react';
import api from '../../api/axios';
import { authApi } from '../../api/modules/auth';
import { endpoints } from '../../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Verify token by fetching /api/me
      api
        .get(endpoints.me)
        .then((res) => {
          setUser(res.data.user);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    if (import.meta.env.DEV) {
      console.log('[AuthProvider] Attempting login for email:', email);
    }
    try {
      const res = await authApi.login({ email, password });
      if (import.meta.env.DEV) {
        console.log('[AuthProvider] Login API response:', res.data);
      }
      localStorage.setItem('accessToken', res.data.accessToken);
      setUser(res.data.user);
      // Navigation handled by component
      return res.data;
    } catch (error) {
      // Always log errors to console for debugging
      console.error('=== AUTH PROVIDER LOGIN ERROR ===');
      console.error('Full error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response);
      console.error('Error response data:', error?.response?.data);
      console.error('Error response status:', error?.response?.status);
      console.error('Error config:', error?.config);
      console.error('==================================');
      throw error; // Re-throw to be handled by component
    }
  };

  const signup = async (email, password, senderName, company) => {
    const res = await authApi.register({ email, password, senderName, company });
    localStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.user);
    // Navigation handled by component
    return res.data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      // Log to error tracking service in production (e.g., Sentry)
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('Logout API call failed:', error);
      }
    }
    localStorage.removeItem('accessToken');
    setUser(null);
    // Navigation handled by component
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

