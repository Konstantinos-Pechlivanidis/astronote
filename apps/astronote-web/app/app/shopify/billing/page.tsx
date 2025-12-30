'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { shopifyClient } from '@/lib/api/shopifyClient';
import { CreditCard } from 'lucide-react';

export default function ShopifyBillingPage() {
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['shopify-balance'],
    queryFn: () => shopifyClient.getBalance(),
  });

  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['shopify-packages'],
    queryFn: () => shopifyClient.getPackages(),
  });

  const handlePurchase = async (packageId: string) => {
    try {
      const { url, checkoutUrl } = await shopifyClient.purchasePackage(packageId);
      if (url) {
        window.location.href = url;
      } else if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error: any) {
      // Handle error
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Billing</h1>

      <GlassCard className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Credit Balance</h2>
            <p className="text-3xl font-bold text-accent">
              {balanceLoading ? '...' : balance?.balance?.toLocaleString() || 0}
            </p>
          </div>
          <CreditCard className="w-12 h-12 text-accent" />
        </div>
      </GlassCard>

      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-6">Credit Packages</h2>
        {packagesLoading ? (
          <div className="text-text-secondary">Loading packages...</div>
        ) : packages && packages.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <GlassCard key={pkg.id} hover>
                <div className="text-center">
                  <div className="text-2xl font-bold mb-2">{pkg.credits.toLocaleString()}</div>
                  <div className="text-text-secondary text-sm mb-2">Credits</div>
                  <div className="text-xl font-bold text-accent mb-4">
                    €{pkg.price}
                  </div>
                  <Button
                    onClick={() => handlePurchase(pkg.id)}
                    className="w-full"
                    size="sm"
                  >
                    Add fuel (credits)
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard light>
            <p className="text-text-secondary text-center">
              No packages available. Please subscribe first.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

