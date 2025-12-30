'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Determine which client to use based on pathname
function useBillingClient() {
  const pathname = usePathname();
  const isShopify = pathname?.includes('/shopify');

  if (isShopify) {
    // Dynamic import to avoid SSR issues
    const { shopifyClient } = require('@/lib/api/shopifyClient');
    return shopifyClient;
  } else {
    const { retailClient } = require('@/lib/api/retailClient');
    return retailClient;
  }
}

// Pricing constants - single source of truth
const PLANS = {
  monthly: {
    planType: 'starter',
    name: 'Monthly',
    price: 40,
    priceDisplay: '€40',
    period: 'month',
    credits: 100,
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_STARTER_EUR',
  },
  yearly: {
    planType: 'pro',
    name: 'Yearly',
    price: 240,
    priceDisplay: '€240',
    period: 'year',
    credits: 500,
    stripePriceIdEnv: 'STRIPE_PRICE_ID_SUB_PRO_EUR',
  },
};

export default function BillingPage() {
  const pathname = usePathname();
  const isShopify = pathname?.includes('/shopify');
  const client = useBillingClient();

  // Get balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: [isShopify ? 'shopify-balance' : 'retail-balance'],
    queryFn: () => client.getBalance(),
  });

  // Get subscription status
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: [isShopify ? 'shopify-subscription' : 'retail-subscription'],
    queryFn: () => isShopify ? client.getSubscriptionStatus() : client.getCurrentSubscription(),
    enabled: !!balance,
  });

  // Get packages (only if subscription active)
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: [isShopify ? 'shopify-packages' : 'retail-packages'],
    queryFn: () => client.getPackages(),
    enabled: subscription?.active || subscription?.status === 'active',
  });

  // Get transactions
  const { data: transactions } = useQuery({
    queryKey: [isShopify ? 'shopify-transactions' : 'retail-transactions'],
    queryFn: () => isShopify ? client.getHistory({ page: 1, limit: 10 }) : client.getTransactions({ page: 1, pageSize: 10 }),
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (planType: 'starter' | 'pro') => client.subscribe(planType),
    onSuccess: (data: { url?: string; checkoutUrl?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create subscription');
    },
  });

  // Purchase package mutation
  const purchaseMutation = useMutation({
    mutationFn: (packageId: number | string) => client.purchasePackage(packageId),
    onSuccess: (data: { url?: string; checkoutUrl?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create purchase');
    },
  });

  const handleSubscribe = (planType: 'starter' | 'pro') => {
    subscribeMutation.mutate(planType);
  };

  const handlePurchasePackage = (packageId: number | string) => {
    purchaseMutation.mutate(packageId);
  };

  const currentPlan = subscription?.planType || subscription?.plan?.planType;
  const isMonthly = currentPlan === 'starter';
  const isYearly = currentPlan === 'pro';

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Billing</h1>

      {/* Balance Card */}
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
        {subscription && (subscription.active || subscription.status === 'active') && (
          <div className="pt-4 border-t border-border">
            <p className="text-text-secondary text-sm">
              Active Subscription: <span className="text-text-primary font-medium">
                {isMonthly ? 'Monthly (€40/month, 100 credits)' : isYearly ? 'Yearly (€240/year, 500 credits)' : currentPlan}
              </span>
            </p>
          </div>
        )}
      </GlassCard>

      {/* Subscription Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-6">Subscription</h2>
        {subLoading ? (
          <div className="text-text-secondary">Loading subscription status...</div>
        ) : subscription && (subscription.active || subscription.status === 'active') ? (
          <GlassCard>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-2">Current Plan</h3>
                <p className="text-text-secondary mb-1">
                  {isMonthly ? (
                    <>Monthly Plan: <strong>€40/month</strong> with 100 free credits per billing cycle</>
                  ) : isYearly ? (
                    <>Yearly Plan: <strong>€240/year</strong> (€20/month effective) with 500 free credits per billing cycle</>
                  ) : (
                    <>Plan: <strong>{currentPlan}</strong></>
                  )}
                </p>
                <p className="text-xs text-text-tertiary mt-2">
                  Next billing cycle: Credits will be allocated automatically
                </p>
              </div>
              <Button variant="outline" size="sm">
                Manage Subscription
              </Button>
            </div>
          </GlassCard>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Monthly Plan */}
            <GlassCard hover>
              <h3 className="text-xl font-semibold mb-2">{PLANS.monthly.name}</h3>
              <div className="mb-4">
                <div className="text-3xl font-bold mb-1">{PLANS.monthly.priceDisplay}</div>
                <div className="text-sm text-text-secondary">per month</div>
                <div className="text-sm text-accent mt-1">{PLANS.monthly.credits} free credits/month</div>
              </div>
              <ul className="space-y-2 mb-6 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>{PLANS.monthly.credits} free credits per billing cycle</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>All core features</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Buy extra credits anytime</span>
                </li>
              </ul>
              <Button
                onClick={() => handleSubscribe('starter')}
                className="w-full"
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? 'Processing...' : 'Start Monthly Plan'}
              </Button>
            </GlassCard>

            {/* Yearly Plan */}
            <GlassCard hover className="ring-2 ring-accent">
              <div className="flex items-center justify-center mb-2">
                <span className="px-2 py-1 rounded-full bg-accent-light text-accent text-xs font-medium">
                  Best Value
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-2">{PLANS.yearly.name}</h3>
              <div className="mb-4">
                <div className="text-3xl font-bold mb-1">{PLANS.yearly.priceDisplay}</div>
                <div className="text-sm text-text-secondary">per year</div>
                <div className="text-sm text-accent mt-1">€20/month effective</div>
                <div className="text-sm text-accent mt-1">{PLANS.yearly.credits} free credits/year</div>
              </div>
              <ul className="space-y-2 mb-6 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>{PLANS.yearly.credits} free credits per billing cycle (5x more)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>All Monthly features</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>Save €240/year (50% off)</span>
                </li>
              </ul>
              <Button
                onClick={() => handleSubscribe('pro')}
                className="w-full"
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? 'Processing...' : 'Start Yearly Plan'}
              </Button>
            </GlassCard>
          </div>
        )}
      </div>

      {/* Credit Packages */}
      {subscription && (subscription.active || subscription.status === 'active') && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6">Buy Extra Credits</h2>
          {packagesLoading ? (
            <div className="text-text-secondary">Loading packages...</div>
          ) : packages && (Array.isArray(packages) ? packages.length > 0 : packages.packages?.length > 0) ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(Array.isArray(packages) ? packages : packages.packages || []).map((pkg: any) => (
                <GlassCard key={pkg.id} hover>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">{pkg.credits?.toLocaleString() || pkg.units?.toLocaleString()}</div>
                    <div className="text-text-secondary text-sm mb-2">Credits</div>
                    <div className="text-xl font-bold text-accent mb-4">
                      €{pkg.price || (pkg.priceCents / 100).toFixed(2)}
                    </div>
                    <Button
                      onClick={() => handlePurchasePackage(pkg.id)}
                      className="w-full"
                      size="sm"
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Add fuel (credits)'}
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard light>
              <p className="text-text-secondary text-center">
                No credit packages available at this time.
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Transactions */}
      {transactions && (
        <div>
          <h2 className="text-2xl font-semibold mb-6">Recent Transactions</h2>
          <GlassCard>
            {transactions.items?.length > 0 || transactions.transactions?.length > 0 ? (
              <div className="space-y-3">
                {(transactions.items || transactions.transactions || []).slice(0, 10).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium text-text-primary">{tx.type || 'Transaction'}</div>
                      <div className="text-sm text-text-secondary">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-text-primary">
                        {tx.credits ? `+${tx.credits} credits` : `€${tx.amount || 0}`}
                      </div>
                      <div className="text-sm text-text-secondary">{tx.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">No transactions yet</p>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

