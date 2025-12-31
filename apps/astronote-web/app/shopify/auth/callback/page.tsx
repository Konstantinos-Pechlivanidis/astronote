'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Shopify Auth Callback Redirect Shim
 *
 * This route handles the backend redirect from:
 * /shopify/auth/callback?token=... (backend redirects here)
 *
 * And redirects internally to:
 * /app/shopify/auth/callback?token=... (actual handler)
 *
 * This shim is needed because:
 * - Backend redirects to /shopify/auth/callback
 * - But Next.js route is at /app/shopify/auth/callback
 */
function ShopifyAuthCallbackRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    // Build query string with all params (preserve any additional params)
    const params = new URLSearchParams();

    if (token) {
      params.set('token', token);
    }

    if (error) {
      params.set('error', error);
    }

    // If we have token or error, redirect to the actual handler
    if (token || error) {
      const queryString = params.toString();
      router.push(`/app/shopify/auth/callback?${queryString}`);
    } else {
      // No token or error - redirect to login
      router.push('/app/shopify/auth/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-background">
      <div className="text-center max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
        <h1 className="text-2xl font-bold mb-4">Redirecting...</h1>
        <p className="text-text-secondary">Please wait while we complete authentication.</p>
      </div>
    </div>
  );
}

/**
 * Shopify Auth Callback Redirect Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function ShopifyAuthCallbackRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-background">
          <div className="text-center max-w-md w-full">
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p className="text-text-secondary">Please wait...</p>
          </div>
        </div>
      }
    >
      <ShopifyAuthCallbackRedirect />
    </Suspense>
  );
}

