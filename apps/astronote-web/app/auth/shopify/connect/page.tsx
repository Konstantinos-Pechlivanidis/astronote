'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shopifyClient } from '@/lib/api/shopifyClient';
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

  const handleOAuthConnect = async () => {
    if (!shop) {
      toast.error('Please enter your Shopify store domain');
      return;
    }

    setIsLoading(true);
    try {
      const response = await shopifyClient.initiateOAuth(shop);
      // Redirect to Shopify OAuth
      window.location.href = response.authUrl;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to initiate connection');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <GlassCard>
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent-light mb-6 mx-auto">
              <Store className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-center">Connect Shopify Store</h1>
            <p className="text-text-secondary mb-8 text-center">
              {isEmbedded
                ? 'Connecting your Shopify store...'
                : 'Enter your Shopify store domain to get started'}
            </p>

            {!isEmbedded && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
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
                    <span className="flex items-center text-text-tertiary">.myshopify.com</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    Enter just the store name (e.g., &quot;your-store&quot; not &quot;your-store.myshopify.com&quot;)
                  </p>
                </div>

                <Button
                  onClick={handleOAuthConnect}
                  className="w-full"
                  size="lg"
                  disabled={isLoading || !shop}
                >
                  {isLoading ? 'Connecting...' : 'Connect Store'}
                </Button>
              </div>
            )}

            {isEmbedded && isLoading && (
              <div className="text-center">
                <p className="text-text-secondary">Authenticating with Shopify...</p>
              </div>
            )}

            <div className="mt-6 text-center">
              <a href="/auth" className="text-sm text-text-tertiary hover:text-text-secondary">
                ← Back to service selection
              </a>
            </div>
          </GlassCard>
        </div>
      </main>

      <Footer />
    </div>
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

