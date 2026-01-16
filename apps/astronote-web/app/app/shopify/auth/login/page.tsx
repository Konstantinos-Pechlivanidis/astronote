'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SHOPIFY_API_BASE_URL } from '@/src/lib/shopify/config';
import { topLevelRedirect } from '@/src/lib/shopify/auth/redirect';
import { getShopifySessionToken, isEmbeddedShopifyApp } from '@/src/lib/shopify/auth/session-token';
import { exchangeShopifyToken } from '@/src/lib/shopify/api/auth';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Logo } from '@/src/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

/**
 * Shopify Login Page Content
 * - Embedded mode: exchange session token automatically
 * - Standalone mode: show shop domain input and trigger OAuth
 */
function ShopifyLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queryError = searchParams.get('error');
    if (queryError) {
      setError(decodeURIComponent(queryError));
    }

    const queryShop = searchParams.get('shop') || searchParams.get('shop_domain');
    if (queryShop && !shopDomain) {
      setShopDomain(queryShop);
    }
  }, [searchParams, shopDomain]);

  // Auto-authenticate if in embedded mode
  useEffect(() => {
    if (isEmbeddedShopifyApp()) {
      const sessionToken = getShopifySessionToken();
      if (sessionToken) {
        setIsLoading(true);
        exchangeShopifyToken(sessionToken)
          .then((result) => {
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
            router.push('/app/shopify/dashboard');
          })
          .catch((err) => {
            setError(err?.message || 'Failed to authenticate');
            setIsLoading(false);
          });
      }
    }
  }, [router]);

  const handleLogin = () => {
    if (!shopDomain.trim()) {
      setError('Please enter your shop domain');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Normalize shop domain
    const normalizedDomain = shopDomain.includes('.myshopify.com')
      ? shopDomain
      : `${shopDomain}.myshopify.com`;

    // Redirect to backend OAuth endpoint (top-level redirect for OAuth)
    topLevelRedirect(`${SHOPIFY_API_BASE_URL}/auth/shopify?shop=${normalizedDomain}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-md">
        <RetailCard className="p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="flex items-center justify-center">
              <Logo size="lg" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">
                Shopify Login
              </h1>
              <p className="text-sm text-text-secondary sm:text-base">
                Connect your Shopify store to get started
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
              <p className="text-sm text-text-secondary">Authenticating...</p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 backdrop-blur-sm">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="shop" className="block text-sm font-medium text-text-secondary">
                  Shop Domain
                </label>
                <Input
                  id="shop"
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="example.myshopify.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLogin();
                    }
                  }}
                />
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleLogin}
                  className="w-full h-12 text-base font-semibold shadow-sm"
                  size="lg"
                >
                  Log in with Shopify
                </Button>
              </div>

              <div className="pt-1 text-center">
                <Link
                  href="/"
                  className="text-sm text-text-tertiary underline-offset-4 hover:text-text-secondary hover:underline"
                >
                  Back to website
                </Link>
              </div>
            </div>
          )}
        </RetailCard>
      </div>
    </div>
  );
}

/**
 * Shopify Login Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function ShopifyLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="w-full max-w-md">
            <RetailCard className="p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="flex items-center justify-center">
                  <Logo size="lg" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-text-primary sm:text-4xl">
                    Shopify Login
                  </h1>
                  <p className="text-sm text-text-secondary sm:text-base">
                    Loading...
                  </p>
                </div>
              </div>
            </RetailCard>
          </div>
        </div>
      }
    >
      <ShopifyLoginPageContent />
    </Suspense>
  );
}
