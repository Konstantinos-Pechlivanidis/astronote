'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RetailCard } from '@/src/components/retail/RetailCard';

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

        // CRITICAL: Extract and store shop domain IMMEDIATELY from token or URL
        // This ensures shopDomain is available for API calls even if token verification fails
        let storeInfo: { id?: string | number; shopDomain?: string; credits?: number; currency?: string } | null = null;

        // Priority 1: Decode token to get shopDomain (fast, no API call)
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            // Extract store info from token payload
            if (payload.shopDomain) {
              storeInfo = {
                id: payload.storeId,
                shopDomain: payload.shopDomain,
              };
              // Save basic store info from token IMMEDIATELY (ensures shopDomain is always stored)
              localStorage.setItem('shopify_store', JSON.stringify(storeInfo));
            }
          }
        } catch (decodeError) {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.warn('Could not decode token:', decodeError);
          }
        }

        // Priority 2: If token decode failed, try URL query param (for redirect flows)
        if (!storeInfo || !storeInfo.shopDomain) {
          const urlParams = new URLSearchParams(window.location.search);
          const queryShop = urlParams.get('shop');

          if (queryShop) {
            // Normalize shop domain
            const normalizedShop = queryShop.includes('.myshopify.com')
              ? queryShop
              : `${queryShop}.myshopify.com`;

            // Validate format
            if (/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(normalizedShop)) {
              storeInfo = {
                shopDomain: normalizedShop,
              };
              // Store immediately for API calls
              localStorage.setItem('shopify_store', JSON.stringify(storeInfo));
            }
          }
        }

        // Try to verify token and get full store info from backend
        // This ensures we have the most up-to-date store info
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
          // If verify fails, check if we have shopDomain from token
          if (!storeInfo || !storeInfo.shopDomain) {
            // Try to get shopDomain from URL query param as last resort
            const urlParams = new URLSearchParams(window.location.search);
            const queryShop = urlParams.get('shop');

            if (queryShop) {
              // Normalize shop domain
              const normalizedShop = queryShop.includes('.myshopify.com')
                ? queryShop
                : `${queryShop}.myshopify.com`;

              // Validate format
              if (/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(normalizedShop)) {
                storeInfo = {
                  shopDomain: normalizedShop,
                };
                localStorage.setItem('shopify_store', JSON.stringify(storeInfo));
            }
          }

            // If still no shopDomain, this is a problem
            if (!storeInfo || !storeInfo.shopDomain) {
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
          }
          // We have basic info from token or query param, continue with redirect
          if (process.env.NODE_ENV === 'development') {
            console.warn('Token verify failed, but using fallback shopDomain:', storeInfo?.shopDomain);
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-md">
        <RetailCard className="p-6 sm:p-8 lg:p-10">
          <div className="text-center">
            {status === 'processing' && (
              <>
                <div className="mb-6 flex justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
                <h1 className="mb-4 text-2xl font-bold text-text-primary">
                  Completing Authentication
                </h1>
                <p className="text-sm text-text-secondary">
                  Please wait while we verify your connection...
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mb-6 flex justify-center">
                  <div className="rounded-xl bg-accent-light p-4">
                    <svg
                      className="h-8 w-8 text-accent"
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
                <h1 className="mb-4 text-2xl font-bold text-accent">Successfully Connected!</h1>
                <p className="mb-6 text-sm text-text-secondary">
                  Your Shopify store has been connected. Redirecting to dashboard...
                </p>
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mb-6 flex justify-center">
                  <div className="rounded-xl bg-red-500/20 p-4">
                    <svg
                      className="h-8 w-8 text-red-500"
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
                <h1 className="mb-4 text-2xl font-bold text-red-500">Authentication Failed</h1>
                <p className="mb-6 text-sm text-text-secondary">
                  {error || 'An error occurred during authentication'}
                </p>
                <p className="text-xs text-text-tertiary">Redirecting to login page...</p>
              </>
            )}
          </div>
        </RetailCard>
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
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="w-full max-w-md">
            <RetailCard className="p-6 sm:p-8 lg:p-10">
              <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
                <h1 className="mb-4 text-2xl font-bold text-text-primary">Loading...</h1>
                <p className="text-sm text-text-secondary">Please wait...</p>
              </div>
            </RetailCard>
          </div>
        </div>
      }
    >
      <ShopifyAuthCallbackContent />
    </Suspense>
  );
}

