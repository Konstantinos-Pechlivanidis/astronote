'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shopifyClient } from '@/lib/api/shopifyClient';
import { SHOPIFY_API_BASE_URL } from '@/src/lib/shopify/config';
import { topLevelRedirect } from '@/src/lib/shopify/auth/redirect';
import { toast } from 'sonner';
import { Store } from 'lucide-react';

function ShopifyConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shop, setShop] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);

  const handleTokenExchange = useCallback(async (sessionToken: string) => {
    setIsLoading(true);
    try {
      await shopifyClient.exchangeToken(sessionToken);
      toast.success('Connected successfully!');
      router.push('/app/shopify');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Check if we're in an iframe (Shopify embedded app)
    setIsEmbedded(window.self !== window.top);

    // Check for session token from Shopify App Bridge
    const sessionToken = searchParams.get('sessionToken');
    if (sessionToken) {
      handleTokenExchange(sessionToken);
    }
  }, [searchParams, handleTokenExchange]);

  const handleOAuthConnect = () => {
    if (!shop) {
      toast.error('Please enter your Shopify store domain');
      return;
    }

    // Normalize shop domain
    const normalizedDomain = shop.includes('.myshopify.com')
      ? shop
      : `${shop}.myshopify.com`;

    // Use top-level redirect to backend OAuth endpoint (which will redirect to Shopify)
    // This avoids CORS issues with XMLHttpRequest
    topLevelRedirect(`${SHOPIFY_API_BASE_URL}/auth/shopify?shop=${normalizedDomain}`);
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto text-white space-y-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-[#0ed7c4]/15 border border-[#0ed7c4]/30 mx-auto">
          <Store className="w-8 h-8 text-[#0ed7c4]" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">Shopify</p>
          <h1 className="text-3xl font-bold">Connect your store</h1>
          <p className="text-sm text-white/75">
            {isEmbedded ? 'Connecting your Shopify store...' : 'Enter your Shopify store domain to get started'}
          </p>
        </div>

        <PublicCard>
          {!isEmbedded && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Store Domain
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="your-store"
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                    className="flex-1"
                  />
                  <span className="flex items-center text-white/60">.myshopify.com</span>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  Enter just the store name (e.g., &quot;your-store&quot; not &quot;your-store.myshopify.com&quot;)
                </p>
              </div>

              <Button
                onClick={handleOAuthConnect}
                className="w-full bg-[#0ed7c4] text-[#0b1f2e] hover:bg-[#12b6a7]"
                size="lg"
                disabled={isLoading || !shop}
              >
                {isLoading ? 'Connecting...' : 'Connect Store'}
              </Button>
            </div>
          )}

          {isEmbedded && isLoading && (
            <div className="text-center text-white/75">Authenticating with Shopify...</div>
          )}

          <div className="mt-6 text-center">
            <a href="/auth" className="text-sm text-white/70 hover:text-white">
              ← Back to service selection
            </a>
          </div>
        </PublicCard>
      </div>
    </PublicLayout>
  );
}

export default function ShopifyConnectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="text-center py-8">Loading...</div>
          </div>
        </div>
      </div>
    }>
      <ShopifyConnectContent />
    </Suspense>
  );
}
