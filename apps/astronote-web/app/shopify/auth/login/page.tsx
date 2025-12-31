'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SHOPIFY_API_BASE_URL } from '@/src/lib/shopify/config';
import { topLevelRedirect } from '@/src/lib/shopify/auth/redirect';
import { getShopifySessionToken, isEmbeddedShopifyApp } from '@/src/lib/shopify/auth/session-token';
import { exchangeShopifyToken } from '@/src/lib/shopify/api/auth';

/**
 * Shopify Login Page
 * - Embedded mode: exchange session token automatically
 * - Standalone mode: show shop domain input and trigger OAuth
 */
export default function ShopifyLoginPage() {
  const router = useRouter();
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen flex items-center justify-center px-4 py-20 bg-background">
      <div className="p-8 md:p-12 max-w-md w-full glass rounded-xl border border-border">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-lg bg-accent flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Shopify Login</h1>
          <p className="text-text-secondary">Connect your Shopify store to get started</p>
        </div>

        {isLoading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
            <p className="text-text-secondary">Authenticating...</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="shop" className="block text-sm font-medium text-text-primary mb-2">
                  Shop Domain
                </label>
                <input
                  id="shop"
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="example.myshopify.com"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 min-h-[44px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLogin();
                    }
                  }}
                />
              </div>

              <button
                onClick={handleLogin}
                className="w-full px-4 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium min-h-[44px]"
              >
                Log in with Shopify
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

