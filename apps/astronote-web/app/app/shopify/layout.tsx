'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShopifyShell } from '@/src/components/shopify/ShopifyShell';
import { getShopifySessionToken, isEmbeddedShopifyApp } from '@/src/lib/shopify/auth/session-token';
import { exchangeShopifyToken, verifyToken } from '@/src/lib/shopify/api/auth';
import { ShopifyErrorBoundary } from './_components/ErrorBoundary';

/**
 * Shopify App Layout
 * - Auth guard: checks JWT token on load
 * - Handles embedded iframe constraints
 * - Wraps children with ShopifyShell
 * - Shows loading/skeleton while verifying
 * - Redirects to login if unauthenticated
 */
export default function ShopifyLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Skip auth check for login and callback pages
  const isAuthPage =
    pathname?.includes('/app/shopify/auth/login') ||
    pathname?.includes('/app/shopify/auth/callback');

  useEffect(() => {
    // Skip authentication for auth pages
    if (isAuthPage) {
      setIsLoading(false);
      setIsAuthenticated(true); // Allow rendering of auth pages
      return;
    }

    let cancelled = false;

    const authenticate = async () => {
      try {
        // Check if we have a stored token
        const storedToken = typeof window !== 'undefined' ? localStorage.getItem('shopify_token') : null;

        // If we're in embedded mode and have a session token, exchange it
        if (isEmbeddedShopifyApp()) {
          const sessionToken = getShopifySessionToken();
          if (sessionToken && !storedToken) {
            try {
              const result = await exchangeShopifyToken(sessionToken);
              if (typeof window !== 'undefined') {
                localStorage.setItem('shopify_token', result.token);
                localStorage.setItem(
                  'shopify_store',
                  JSON.stringify({
                    id: result.store.id,
                    shopDomain: result.store.shopDomain,
                    credits: result.store.credits,
                    currency: result.store.currency,
                  }),
                );
              }
              if (!cancelled) {
                setIsAuthenticated(true);
                setIsLoading(false);
              }
              return;
            } catch (exchangeError: any) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Token exchange failed:', exchangeError);
              }
              if (!cancelled) {
                setError(exchangeError?.message || 'Failed to authenticate');
                setIsLoading(false);
              }
              return;
            }
          }
        }

        // If we have a stored token, verify it
        if (storedToken) {
          try {
            await verifyToken();
            if (!cancelled) {
              setIsAuthenticated(true);
              setIsLoading(false);
            }
            return;
          } catch (verifyError: any) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Token verification failed:', verifyError);
            }
            // Clear invalid token
            if (typeof window !== 'undefined') {
              localStorage.removeItem('shopify_token');
              localStorage.removeItem('shopify_store');
            }
            if (!cancelled) {
              setError(verifyError?.message || 'Token verification failed');
              setIsLoading(false);
            }
            return;
          }
        }

        // No token and not in embedded mode - redirect to login
        if (!cancelled) {
          setIsLoading(false);
          setIsAuthenticated(false);
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Authentication error:', err);
        }
        if (!cancelled) {
          setError(err?.message || 'Authentication failed');
          setIsLoading(false);
        }
      }
    };

    // Set timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    }, 5000); // Max 5 seconds

    authenticate();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isAuthPage]);

  // Redirect to login if not authenticated (after loading completes)
  useEffect(() => {
    if (!isAuthPage && !isLoading && !isAuthenticated) {
      router.push('/app/shopify/auth/login');
    }
  }, [isAuthPage, isLoading, isAuthenticated, router]);

  // For auth pages, render without shell
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-text-secondary">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">Authentication Error</div>
          <p className="text-text-secondary mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              window.location.reload();
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // Render authenticated app with shell and error boundary
  return (
    <ShopifyErrorBoundary>
      <ShopifyShell>{children}</ShopifyShell>
    </ShopifyErrorBoundary>
  );
}

