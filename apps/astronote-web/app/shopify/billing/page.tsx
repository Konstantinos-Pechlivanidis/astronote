'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useBillingBalance } from '@/src/features/shopify/billing/hooks/useBillingBalance';
import { useBillingPackages } from '@/src/features/shopify/billing/hooks/useBillingPackages';
import { useBillingHistory } from '@/src/features/shopify/billing/hooks/useBillingHistory';
import { useSubscriptionStatus } from '@/src/features/shopify/billing/hooks/useSubscriptionStatus';
import {
  useCreatePurchase,
  useCreateTopup,
} from '@/src/features/shopify/billing/hooks/useBillingMutations';
import { useCalculateTopup } from '@/src/features/shopify/billing/hooks/useCalculateTopup';
import {
  useSubscribe,
  useUpdateSubscription,
  useCancelSubscription,
  useGetPortal,
} from '@/src/features/shopify/billing/hooks/useSubscriptionMutations';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/src/components/retail/EmptyState';
import {
  CreditCard,
  Wallet,
  TrendingUp,
  History,
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Billing Page
 */
export default function BillingPage() {
  const searchParams = useSearchParams();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [topupCredits, setTopupCredits] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Handle URL params for success/cancel
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Payment completed successfully!');
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Payment was cancelled');
    }
  }, [searchParams]);

  // Fetch data
  const { data: balanceData } = useBillingBalance();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const { data: packagesData, isLoading: packagesLoading } = useBillingPackages(selectedCurrency);
  const { data: historyData, isLoading: historyLoading } = useBillingHistory({ page, pageSize });

  // Mutations
  const createPurchase = useCreatePurchase();
  const createTopup = useCreateTopup();
  const subscribe = useSubscribe();
  const updateSubscription = useUpdateSubscription();
  const cancelSubscription = useCancelSubscription();
  const getPortal = useGetPortal();

  // Calculate top-up price
  const creditsNum = topupCredits ? parseInt(topupCredits) : null;
  const { data: topupPriceData, isLoading: topupPriceLoading } = useCalculateTopup(
    creditsNum && creditsNum > 0 && creditsNum <= 1000000 ? creditsNum : null,
  );

  // Normalize data
  const balance = balanceData?.credits || balanceData?.balance || 0;
  const currency = balanceData?.currency || selectedCurrency || 'EUR';
  const subscription = subscriptionData || { active: false, planType: null };
  const isSubscriptionActive = subscription.active === true;
  const subscriptionPlan = subscription.planType || null;
  const packages = packagesData?.packages || [];
  const subscriptionRequired = packagesData?.subscriptionRequired === false ? false : packages.length === 0 && isSubscriptionActive === false;
  const history = historyData?.transactions || [];
  const pagination = historyData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const topupPrice = topupPriceData;

  // Get frontend URL for checkout redirects
  const getFrontendUrl = (path: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${path}`;
  };

  const handlePurchase = async (packageId: string) => {
    try {
      const successUrl = getFrontendUrl(
        '/app/shopify/billing/success?session_id={CHECKOUT_SESSION_ID}&type=credit_pack',
      );
      const cancelUrl = getFrontendUrl('/app/shopify/billing/cancel');

      await createPurchase.mutateAsync({
        packageId,
        successUrl,
        cancelUrl,
        currency: selectedCurrency,
      });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleTopup = async () => {
    const credits = parseInt(topupCredits);
    if (!credits || credits <= 0) {
      toast.error('Please enter a valid number of credits');
      return;
    }

    if (credits > 1000000) {
      toast.error('Maximum 1,000,000 credits per purchase');
      return;
    }

    try {
      const successUrl = getFrontendUrl(
        '/app/shopify/billing/success?session_id={CHECKOUT_SESSION_ID}&type=credit_topup',
      );
      const cancelUrl = getFrontendUrl('/app/shopify/billing/cancel');

      await createTopup.mutateAsync({
        credits,
        successUrl,
        cancelUrl,
      });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleSubscribe = async (planType: 'starter' | 'pro') => {
    try {
      await subscribe.mutateAsync({ planType });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleUpdateSubscription = async (planType: 'starter' | 'pro') => {
    try {
      await updateSubscription.mutateAsync({ planType });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to subscription benefits.')) {
      return;
    }

    try {
      await cancelSubscription.mutateAsync();
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleManageSubscription = async () => {
    try {
      await getPortal.mutateAsync();
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const isLowBalance = balance < 100;

  return (
    <div>
      {/* Header */}
      <RetailPageHeader
        title="Billing"
        description="Manage your SMS credits and subscription"
      />

      <div className="space-y-6">
        {/* Current Balance */}
        <RetailCard
          className={`p-6 ${isLowBalance ? 'border-2 border-red-500/50 bg-red-500/10' : ''}`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-2xl bg-surface-light">
                  <Wallet className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1 uppercase tracking-wide">
                    Current Balance
                  </div>
                  <div className={`text-4xl sm:text-5xl font-bold ${isLowBalance ? 'text-red-500' : 'text-accent'}`}>
                    {balance.toLocaleString()}
                  </div>
                  <div className="text-base text-text-secondary mt-1">SMS credits</div>
                </div>
              </div>
              {isLowBalance && (
                <div className="flex items-center gap-3 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500 font-medium">
                    Low balance. Consider purchasing more credits to continue sending messages.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 rounded-xl bg-surface-light border border-border">
              <div className="text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                Currency
              </div>
              <div className="text-xl font-bold text-text-primary">{currency}</div>
            </div>
          </div>
        </RetailCard>

        {/* Subscription Section */}
        <RetailCard className="p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Subscription</h2>

          {subscriptionLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          ) : isSubscriptionActive ? (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <StatusBadge status="success" label="Active" />
                  <h3 className="text-xl font-bold text-text-primary capitalize">
                    {subscriptionPlan} Plan
                  </h3>
                </div>
                <p className="text-base text-text-secondary">
                  {subscriptionPlan === 'starter'
                    ? '€40/month - 100 free credits per month'
                    : '€240/year - 500 free credits per year'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleManageSubscription} disabled={getPortal.isPending}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Subscription
                </Button>
                {subscriptionPlan === 'starter' ? (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateSubscription('pro')}
                    disabled={updateSubscription.isPending}
                  >
                    Upgrade to Pro
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateSubscription('starter')}
                    disabled={updateSubscription.isPending}
                  >
                    Downgrade to Starter
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={cancelSubscription.isPending}
                  className="text-red-400 hover:text-red-500"
                >
                  Cancel Subscription
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <RetailCard className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-text-primary">Starter Plan</h3>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-3xl font-bold text-text-primary">€40</span>
                      <span className="text-base text-text-secondary">/month</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">100 free credits per month</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">All features included</span>
                    </li>
                  </ul>
                  <Button
                    onClick={() => handleSubscribe('starter')}
                    disabled={subscribe.isPending}
                    className="w-full"
                  >
                    Subscribe to Starter
                  </Button>
                </div>
              </RetailCard>
              <RetailCard className="p-6 border-2 border-accent relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="px-4 py-1.5 text-xs font-bold rounded-full bg-accent text-white">
                    Best Value
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-text-primary">Pro Plan</h3>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-3xl font-bold text-text-primary">€240</span>
                      <span className="text-base text-text-secondary">/year</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">500 free credits per year</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">All features included</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">Save 50% vs monthly</span>
                    </li>
                  </ul>
                  <Button
                    onClick={() => handleSubscribe('pro')}
                    disabled={subscribe.isPending}
                    className="w-full"
                  >
                    Subscribe to Pro
                  </Button>
                </div>
              </RetailCard>
            </div>
          )}
        </RetailCard>

        {/* Credit Top-up Section */}
        <RetailCard className="p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Credit Top-up</h2>
          <p className="text-sm text-text-secondary mb-6">
            Purchase additional credits at €0.045 per credit (24% VAT included)
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Number of Credits
                </label>
                <Input
                  type="number"
                  min="1"
                  max="1000000"
                  value={topupCredits}
                  onChange={(e) => setTopupCredits(e.target.value)}
                  placeholder="Enter credits (e.g., 1000)"
                />
                {topupCredits && parseInt(topupCredits) > 0 && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    Max 1,000,000 credits per purchase
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">
                  Price Breakdown
                </label>
                {topupPriceLoading ? (
                  <RetailCard className="p-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                      <span className="text-sm text-text-secondary">Calculating...</span>
                    </div>
                  </RetailCard>
                ) : topupPrice?.priceEurWithVat ? (
                  <RetailCard className="p-6 bg-surface-light">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">Base Price:</span>
                        <span className="text-text-primary font-semibold">
                          €{topupPrice?.priceEur?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">VAT (24%):</span>
                        <span className="text-text-primary font-semibold">
                          €{topupPrice?.vatAmount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-semibold text-text-primary">Total:</span>
                          <span className="text-xl font-bold text-accent">
                            €{topupPrice?.priceEurWithVat?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </RetailCard>
                ) : (
                  <RetailCard className="p-6">
                    <p className="text-sm text-text-tertiary text-center">
                      Enter credits to see price
                    </p>
                  </RetailCard>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <Button
              onClick={handleTopup}
              disabled={!topupCredits || parseInt(topupCredits) <= 0 || createTopup.isPending || topupPriceLoading}
              className="min-w-[200px]"
            >
              {createTopup.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Purchase Credits
                </>
              )}
            </Button>
          </div>
        </RetailCard>

        {/* Credit Packs (Only if subscription active) */}
        {isSubscriptionActive && (
          <RetailCard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary mb-1">Credit Packs</h2>
                <p className="text-sm text-text-secondary">Purchase credit packs at discounted rates</p>
              </div>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {packagesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
              </div>
            ) : packages.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No packages available"
                description={
                  subscriptionRequired
                    ? 'Credit packs require an active subscription. Please subscribe first.'
                    : 'Credit packages are currently unavailable. Please try again later.'
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {packages.map((pkg) => (
                  <RetailCard key={pkg.id} className="p-6 relative flex flex-col">
                    <div className="mb-5 flex-grow space-y-4">
                      <div>
                        <h3 className="text-lg font-bold mb-2 text-text-primary">{pkg.name}</h3>
                        {pkg.description && (
                          <p className="text-xs text-text-secondary mb-3">{pkg.description}</p>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-bold text-text-primary">
                          {pkg.price?.toFixed(2)} {pkg.currency || currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-accent" />
                        <p className="text-base font-semibold text-text-primary">
                          {pkg.credits?.toLocaleString() || 0} SMS credits
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={createPurchase.isPending}
                      className="w-full mt-auto"
                    >
                      {createPurchase.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Purchase
                        </>
                      )}
                    </Button>
                  </RetailCard>
                ))}
              </div>
            )}
          </RetailCard>
        )}

        {/* Transaction History */}
        <RetailCard className="p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Purchase History</h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No purchase history"
              description="Your purchase history will appear here once you make your first credit purchase."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-surface-light">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {format(new Date(transaction.createdAt), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary capitalize">
                          {transaction.type?.replace(/_/g, ' ') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {transaction.credits?.toLocaleString() || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {transaction.amount?.toFixed(2) || '0.00'} {transaction.currency || currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            status={
                              transaction.status === 'completed'
                                ? 'success'
                                : transaction.status === 'pending'
                                  ? 'warning'
                                  : 'danger'
                            }
                            label={transaction.status || 'unknown'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                    {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                    {pagination.total} transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrevPage || historyLoading}
                    >
                      Previous
                    </Button>
                    <div className="text-sm text-text-secondary">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={!pagination.hasNextPage || historyLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </RetailCard>
      </div>
    </div>
  );
}
