'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Shopify Auth Callback Page Content
 * Handles OAuth callback from backend
 * - Reads token from query (?token=)
 * - Saves to localStorage (shopify_token, shopify_store)
 * - Redirects to dashboard
 */
function ShopifyAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        // Handle error from backend
        if (errorParam) {
          setStatus('error');
          setError(decodeURIComponent(errorParam));
          setTimeout(() => {
            router.push('/app/shopify/auth/login');
          }, 3000);
          return;
        }

        // Check if token exists
        if (!token) {
          setStatus('error');
          setError('No token received from authentication server');
          setTimeout(() => {
            router.push('/app/shopify/auth/login');
          }, 3000);
          return;
        }

        // Save token to localStorage
        localStorage.setItem('shopify_token', token);

        // Try to decode token to get basic info (JWT structure: header.payload.signature)
        let storeInfo = null;
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            // Extract store info from token payload
            if (payload.storeId && payload.shopDomain) {
              storeInfo = {
                id: payload.storeId,
                shopDomain: payload.shopDomain,
              };
              // Save basic store info from token
              localStorage.setItem('shopify_store', JSON.stringify(storeInfo));
            }
          }
        } catch (decodeError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Could not decode token:', decodeError);
          }
        }

        // Try to verify token and get full store info from backend
        try {
          const { verifyToken } = await import('@/src/lib/shopify/api/auth');
          const response = await verifyToken();

          if (response && response.store) {
            // Save full store info from backend
            const fullStoreInfo = {
              id: response.store.id,
              shopDomain: response.store.shopDomain,
              credits: response.store.credits,
              currency: response.store.currency,
            };
            localStorage.setItem('shopify_store', JSON.stringify(fullStoreInfo));
            storeInfo = fullStoreInfo;
          }
        } catch (verifyError) {
          // If verify fails but we have basic info from token, continue anyway
          // The token will be validated on the next API call
          if (!storeInfo || !storeInfo.shopDomain) {
            // No store info with shopDomain - this is a problem
            if (process.env.NODE_ENV === 'development') {
              console.error('Token verification failed and no shopDomain available:', verifyError);
            }
            localStorage.removeItem('shopify_token');
            localStorage.removeItem('shopify_store');

            setStatus('error');
            setError('Token verification failed. Please try logging in again.');

            setTimeout(() => {
              router.push('/app/shopify/auth/login');
            }, 2000);
            return;
          }
          // We have basic info from token, continue with redirect
          if (process.env.NODE_ENV === 'development') {
            console.warn('Token verify failed, but using token payload info:', verifyError);
          }
        }

        // Success - redirect to dashboard
        setStatus('success');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/app/shopify/dashboard');
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'An unexpected error occurred');

        setTimeout(() => {
          router.push('/app/shopify/auth/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-background">
      <div className="p-8 md:p-12 text-center max-w-md w-full glass rounded-xl border border-border">
        {status === 'processing' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Completing Authentication</h1>
            <p className="text-text-secondary">Please wait while we verify your connection...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-xl bg-accent-light">
                <svg
                  className="w-8 h-8 text-[#0ABAB5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4 text-accent">Successfully Connected!</h1>
            <p className="text-text-secondary mb-6">
              Your Shopify store has been connected. Redirecting to dashboard...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-xl bg-red-500/20">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4 text-red-500">Authentication Failed</h1>
            <p className="text-text-secondary mb-6">
              {error || 'An error occurred during authentication'}
            </p>
            <p className="text-sm text-text-secondary">Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Shopify Auth Callback Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function ShopifyAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-background">
          <div className="p-8 md:p-12 text-center max-w-md w-full glass rounded-xl border border-border">
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p className="text-text-secondary">Please wait...</p>
          </div>
        </div>
      }
    >
      <ShopifyAuthCallbackContent />
    </Suspense>
  );
}

