'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useBillingBalance } from '@/src/features/shopify/billing/hooks/useBillingBalance';
import { useBillingPackages } from '@/src/features/shopify/billing/hooks/useBillingPackages';
import { useBillingHistory } from '@/src/features/shopify/billing/hooks/useBillingHistory';
import { useBillingSummary } from '@/src/features/shopify/billing/hooks/useBillingSummary';
import { useSubscriptionStatus } from '@/src/features/shopify/billing/hooks/useSubscriptionStatus';
import { useBillingProfile } from '@/src/features/shopify/billing/hooks/useBillingProfile';
import { useBillingInvoices } from '@/src/features/shopify/billing/hooks/useBillingInvoices';
import {
  useCreatePurchase,
  useCreateTopup,
  useSyncBillingProfileFromStripe,
} from '@/src/features/shopify/billing/hooks/useBillingMutations';
import { useCalculateTopup } from '@/src/features/shopify/billing/hooks/useCalculateTopup';
import {
  useSubscribe,
  useCancelSubscription,
  useResumeSubscription,
  useGetPortal,
  useSwitchInterval,
  useReconcileSubscription,
} from '@/src/features/shopify/billing/hooks/useSubscriptionMutations';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
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
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Billing Page Content
 */
function BillingPageContent() {
  const searchParams = useSearchParams();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [topupCredits, setTopupCredits] = useState<string>('');
  const [page, setPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const pageSize = 20;

  // Fetch data
  const { data: balanceData } = useBillingBalance();
  const { data: billingSummary, isLoading: summaryLoading } = useBillingSummary();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const { data: packagesData, isLoading: packagesLoading } = useBillingPackages(selectedCurrency);
  const { data: historyData, isLoading: historyLoading } = useBillingHistory({ page, pageSize });
  const { data: billingProfile } = useBillingProfile();
  const { data: invoicesData, isLoading: invoicesLoading } = useBillingInvoices({ page: invoicePage, pageSize });

  // Mutations
  const createPurchase = useCreatePurchase();
  const createTopup = useCreateTopup();
  const subscribe = useSubscribe();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const getPortal = useGetPortal();
  const switchInterval = useSwitchInterval();
  const reconcileSubscription = useReconcileSubscription();
  const syncBillingProfile = useSyncBillingProfileFromStripe();

  // Handle URL params for success/cancel and portal return
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Payment completed successfully!');
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Payment was cancelled');
    } else if (searchParams.get('fromPortal') === 'true') {
      // User returned from Stripe portal - sync billing profile
      syncBillingProfile.mutate();
    }
  }, [searchParams, syncBillingProfile]);

  // Calculate top-up price
  const creditsNum = topupCredits ? parseInt(topupCredits) : null;
  const { data: topupPriceData, isLoading: topupPriceLoading } = useCalculateTopup(
    creditsNum && creditsNum > 0 && creditsNum <= 1000000 ? creditsNum : null,
    selectedCurrency,
  );

  // Normalize data - prefer billing summary if available, fallback to individual calls
  const summary = billingSummary || null;
  const billingCurrency =
    summary?.billingCurrency ||
    (summary?.subscription as any)?.billingCurrency ||
    billingProfile?.currency ||
    balanceData?.currency ||
    'EUR';
  const balance = summary?.credits?.balance || balanceData?.credits || balanceData?.balance || 0;
  const currency = summary?.credits?.currency || balanceData?.currency || billingCurrency || selectedCurrency || 'EUR';
  const currencySymbol = currency === 'USD' ? '$' : '€';
  const showEurPricing = currency === 'EUR';
  const subscriptionRaw = summary?.subscription || subscriptionData || { status: 'inactive', planType: null, interval: null, active: false };
  // Handle subscription type - can be string or object
  const subscription = typeof subscriptionRaw === 'string'
    ? { status: subscriptionRaw, planType: null, interval: null, active: subscriptionRaw === 'active' }
    : subscriptionRaw;
  const isSubscriptionActive = (subscription as any).status === 'active' || (subscription as any).active === true;
  const subscriptionPlan = (subscription as any).planType || null;
  const subscriptionInterval = (subscription as any).interval || null;
  const subscriptionStatus = (subscription as any).status || ((subscription as any).active ? 'active' : 'inactive');
  const normalizedStatus = subscriptionStatus === 'canceled' ? 'cancelled' : subscriptionStatus;
  const statusIsWarning = ['trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(normalizedStatus);
  const statusVariant = normalizedStatus === 'active' ? 'success' : statusIsWarning ? 'warning' : 'danger';
  const statusLabel = normalizedStatus === 'active'
    ? 'Active'
    : normalizedStatus === 'trialing'
      ? 'Trialing'
      : normalizedStatus === 'past_due'
        ? 'Past Due'
        : normalizedStatus === 'unpaid'
          ? 'Unpaid'
          : normalizedStatus === 'incomplete'
            ? 'Incomplete'
            : normalizedStatus === 'paused'
              ? 'Paused'
              : normalizedStatus === 'cancelled'
                ? 'Canceled'
                : 'Inactive';
  const currentPeriodStart = (subscription as any).currentPeriodStart || null;
  const currentPeriodEnd = (subscription as any).currentPeriodEnd || null;
  const cancelAtPeriodEnd = (subscription as any).cancelAtPeriodEnd || false;
  const lastBillingError = (subscription as any).lastBillingError || null;
  const allowance = summary?.allowance || null;
  const packages = packagesData?.packages || [];
  const subscriptionRequired = packagesData?.subscriptionRequired === false ? false : packages.length === 0 && isSubscriptionActive === false;
  const history = historyData?.transactions || [];
  const invoices = invoicesData?.invoices || [];
  const invoicesPagination = invoicesData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const pagination = historyData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const topupPrice = topupPriceData;
  const topupCurrency = topupPrice?.currency || selectedCurrency || currency || 'EUR';
  const topupBase = topupPrice?.basePrice ?? topupPrice?.priceEur ?? 0;
  const topupTax = topupPrice?.taxAmount ?? topupPrice?.vatAmount ?? 0;
  const topupTotal = topupPrice?.totalPrice ?? topupPrice?.priceEurWithVat ?? 0;
  const topupTaxRate = Number.isFinite(topupPrice?.taxRate)
    ? Math.round((topupPrice?.taxRate || 0) * 100)
    : null;

  useEffect(() => {
    if (currencyTouched) return;
    if (billingCurrency && billingCurrency !== selectedCurrency) {
      setSelectedCurrency(billingCurrency);
    }
  }, [billingCurrency, currencyTouched, selectedCurrency]);

  const formatDateSafe = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : format(date, 'MMM d, yyyy');
  };

  const maskedVat = billingProfile?.vatNumber
    ? `${billingProfile.vatNumber.slice(0, 4)}•••${billingProfile.vatNumber.slice(-2)}`
    : null;
  const billingCountry =
    billingProfile?.billingAddress?.country || billingProfile?.vatCountry || null;
  const taxStatus = billingProfile?.taxStatus || null;
  const taxStatusLabel = taxStatus
    ? taxStatus === 'verified'
      ? 'Verified'
      : taxStatus === 'pending'
        ? 'Pending'
        : taxStatus === 'unverified'
          ? 'Unverified'
          : 'Invalid'
    : 'Not provided';
  const taxStatusVariant =
    taxStatus === 'verified'
      ? 'success'
      : taxStatus === 'pending'
        ? 'warning'
        : taxStatus
          ? 'danger'
          : 'warning';

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
        currency: selectedCurrency,
      });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Plan ranking for upgrade/downgrade logic (must match backend plan codes)
  const PLAN_RANK = {
    starter: 1,
    pro: 2,
  } as const;

  // Helper to compute action label for a plan option
  const getPlanActionLabel = (targetPlanType: 'starter' | 'pro', targetInterval: 'month' | 'year') => {
    if (!isSubscriptionActive || !subscriptionPlan) {
      return 'Subscribe';
    }

    const currentRank = PLAN_RANK[subscriptionPlan as keyof typeof PLAN_RANK] || 0;
    const targetRank = PLAN_RANK[targetPlanType] || 0;

    // If different plan
    if (currentRank !== targetRank) {
      return currentRank < targetRank ? 'Upgrade' : 'Downgrade';
    }

    // Same plan, different interval
    if (subscriptionInterval !== targetInterval) {
      return targetInterval === 'year' ? 'Switch to Yearly' : 'Switch to Monthly';
    }

    // Same plan and interval
    return 'Current Plan';
  };

  // Helper to get "what happens" message for a plan option
  const getPlanChangeMessage = (targetPlanType: 'starter' | 'pro', _targetInterval: 'month' | 'year') => {
    if (!isSubscriptionActive || !subscriptionPlan) {
      return 'Takes effect immediately';
    }

    const currentRank = PLAN_RANK[subscriptionPlan as keyof typeof PLAN_RANK] || 0;
    const targetRank = PLAN_RANK[targetPlanType] || 0;
    const isDowngrade = currentRank > targetRank;
    const isProYearlyDowngrade = subscriptionPlan === 'pro' && subscriptionInterval === 'year' && isDowngrade;

    if (isProYearlyDowngrade) {
      const effectiveDate = subscription.currentPeriodEnd
        ? formatDateSafe(subscription.currentPeriodEnd)
        : 'end of term';
      return `Scheduled for end of term (${effectiveDate})`;
    }

    return 'Takes effect immediately';
  };

  const handleSubscribe = async (planType: 'starter' | 'pro') => {
    try {
      // Explicitly set interval: starter = monthly, pro = yearly
      const interval = planType === 'starter' ? 'month' : 'year';
      await subscribe.mutateAsync({ planType, interval, currency });
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

  const handleSwitchInterval = async (interval: 'month' | 'year') => {
    const intervalLabel = interval === 'month' ? 'monthly' : 'yearly';
    // Interval switches are IMMEDIATE (not scheduled at period end)
    const confirmMessage = `Are you sure you want to switch to ${intervalLabel} billing? This change will take effect immediately.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await switchInterval.mutateAsync({ interval });
      // Status will be refreshed automatically via query invalidation in the mutation hook
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const isLowBalance = balance < 100;

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <RetailPageHeader
          title="Billing"
          description="Manage your SMS credits and subscription"
        />
        {/* Subscription Required Banner */}
        {!isSubscriptionActive && (
          <RetailCard className="p-6 border-2 border-red-500/50 bg-red-500/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-red-500 mb-1">Subscription Required</h3>
                <p className="text-sm text-red-500/90">
                  An active subscription is required to send messages. Please subscribe to a plan below.
                </p>
              </div>
            </div>
          </RetailCard>
        )}

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
          {lastBillingError && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Last billing error: {lastBillingError}</span>
              </div>
            </div>
          )}

          {(subscriptionLoading || summaryLoading) ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          ) : isSubscriptionActive ? (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-surface-light border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <StatusBadge
                    status={statusVariant}
                    label={statusLabel}
                  />
                  <h3 className="text-xl font-bold text-text-primary capitalize">
                    {subscriptionPlan ? `${subscriptionPlan} Plan` : 'No Plan'}
                  </h3>
                  {subscriptionInterval && (
                    <span className="text-sm text-text-secondary">
                      ({subscriptionInterval === 'month' ? 'Monthly' : 'Yearly'})
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-base text-text-secondary">
                    {subscriptionPlan === 'starter' && subscriptionInterval === 'month'
                      ? `${showEurPricing ? `${currencySymbol}40/month` : `Billed in ${currency}`} - 100 free SMS per month`
                      : subscriptionPlan === 'pro' && subscriptionInterval === 'year'
                        ? `${showEurPricing ? `${currencySymbol}240/year` : `Billed in ${currency}`} - 500 free SMS per year`
                        : subscriptionPlan
                          ? `Billed in ${currency} - ${subscriptionInterval === 'month' ? 'Monthly' : subscriptionInterval === 'year' ? 'Yearly' : 'Unknown'} billing`
                          : 'No active subscription'}
                  </p>
                  {allowance && (
                    <div className="text-sm text-text-secondary space-y-1">
                      <p>
                        Free SMS included: <span className="font-semibold text-text-primary">
                          {allowance.includedPerPeriod.toLocaleString()}
                        </span>
                      </p>
                      <p>
                        Used this period: <span className="font-semibold text-text-primary">
                          {allowance.usedThisPeriod.toLocaleString()}
                        </span>
                      </p>
                      <p>
                        Remaining: <span className="font-semibold text-text-primary">
                          {allowance.remainingThisPeriod.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  )}
                  {(currentPeriodStart || currentPeriodEnd) && (
                    <p className="text-sm text-text-secondary">
                      Billing period:{' '}
                      <span className="font-semibold text-text-primary">
                        {formatDateSafe(currentPeriodStart) || '—'} – {formatDateSafe(currentPeriodEnd) || '—'}
                      </span>
                    </p>
                  )}
                  {currentPeriodEnd && (
                    <p className="text-sm text-text-secondary">
                      {cancelAtPeriodEnd ? (
                        <>
                          <span className="text-yellow-500 font-semibold">Cancels on</span>{' '}
                          <span className="font-semibold text-text-primary">
                            {formatDateSafe(currentPeriodEnd) || '—'}
                          </span>
                          {' '}(access until then)
                        </>
                      ) : (
                        <>
                          Renews on{' '}
                          <span className="font-semibold text-text-primary">
                            {formatDateSafe(currentPeriodEnd) || '—'}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  {subscription.pendingChange && (
                    <p className="text-sm text-text-secondary">
                      <span className="text-blue-500 font-semibold">Scheduled:</span>{' '}
                      Will switch to{' '}
                      <span className="font-semibold text-text-primary">
                        {subscription.pendingChange.planCode
                          ? subscription.pendingChange.planCode.charAt(0).toUpperCase() + subscription.pendingChange.planCode.slice(1)
                          : 'Unknown'}{' '}
                        — {subscription.pendingChange.interval === 'year' ? 'Yearly' : subscription.pendingChange.interval === 'month' ? 'Monthly' : 'Unknown'}
                      </span>{' '}
                      on{' '}
                      <span className="font-semibold text-text-primary">
                        {subscription.pendingChange.effectiveAt ? formatDateSafe(subscription.pendingChange.effectiveAt) : '—'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleManageSubscription} disabled={getPortal.isPending}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage Payment Method
                </Button>
                <Button
                  variant="outline"
                  onClick={() => reconcileSubscription.mutate()}
                  disabled={reconcileSubscription.isPending}
                >
                  {reconcileSubscription.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Status
                    </>
                  )}
                </Button>
                {subscriptionInterval && (
                  <>
                    {subscriptionInterval === 'month' ? (
                      <Button
                        variant="outline"
                        onClick={() => handleSwitchInterval('year')}
                        disabled={switchInterval.isPending}
                      >
                        Switch to Yearly
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleSwitchInterval('month')}
                        disabled={switchInterval.isPending}
                      >
                        Switch to Monthly
                      </Button>
                    )}
                  </>
                )}
                {subscription?.cancelAtPeriodEnd ? (
                  <Button
                    variant="outline"
                    onClick={() => resumeSubscription.mutate()}
                    disabled={resumeSubscription.isPending}
                    className="text-green-400 hover:text-green-500"
                  >
                    Resume Subscription
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleCancelSubscription}
                    disabled={cancelSubscription.isPending}
                    className="text-red-400 hover:text-red-500"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <RetailCard className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-text-primary">Starter Plan</h3>
                    {showEurPricing ? (
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold text-text-primary">{currencySymbol}40</span>
                        <span className="text-base text-text-secondary">/month</span>
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary mb-4">
                        Pricing shown at checkout in {currency}
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3 mb-4">
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">100 free credits per month</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-sm text-text-secondary">All features included</span>
                    </li>
                  </ul>
                  <p className="text-xs text-text-tertiary mb-4 italic">
                    {getPlanChangeMessage('starter', 'month')}
                  </p>
                  <Button
                    onClick={() => handleSubscribe('starter')}
                    disabled={subscribe.isPending || (isSubscriptionActive && subscriptionPlan === 'starter' && subscriptionInterval === 'month')}
                    className="w-full"
                    variant={isSubscriptionActive && subscriptionPlan === 'starter' && subscriptionInterval === 'month' ? 'outline' : 'default'}
                  >
                    {getPlanActionLabel('starter', 'month')}
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
                    {showEurPricing ? (
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold text-text-primary">{currencySymbol}240</span>
                        <span className="text-base text-text-secondary">/year</span>
                      </div>
                    ) : (
                      <div className="text-sm text-text-secondary mb-4">
                        Pricing shown at checkout in {currency}
                      </div>
                    )}
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
                    disabled={subscribe.isPending || (isSubscriptionActive && subscriptionPlan === 'pro' && subscriptionInterval === 'year')}
                    className="w-full"
                    variant={isSubscriptionActive && subscriptionPlan === 'pro' && subscriptionInterval === 'year' ? 'outline' : 'default'}
                  >
                    {getPlanActionLabel('pro', 'year')}
                  </Button>
                </div>
              </RetailCard>
            </div>
          )}
        </RetailCard>

        {/* Billing Details */}
        <RetailCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-2xl font-bold text-text-primary">Billing Details</h2>
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={getPortal.isPending}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage in Stripe
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-surface-light p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Legal Name
              </div>
              <div className="text-sm text-text-primary">
                {billingProfile?.legalName || 'Not provided'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-light p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                Billing Country
              </div>
              <div className="text-sm text-text-primary">
                {billingCountry || 'Not provided'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-light p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                VAT Number
              </div>
              <div className="text-sm text-text-primary">
                {maskedVat || 'Not provided'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-light p-4">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2">
                VAT Status
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={taxStatusVariant} label={taxStatusLabel} />
                {billingProfile?.taxExempt && (
                  <span className="text-xs text-text-tertiary">Tax exempt</span>
                )}
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-text-tertiary">
            Billing details are collected during Stripe checkout and used to calculate VAT.
          </p>
        </RetailCard>

        {/* Credit Top-up Section */}
        <RetailCard className="p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Credit Top-up</h2>
          <p className="text-sm text-text-secondary mb-6">
            Purchase additional credits. Tax is calculated at checkout based on your billing details.
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
                ) : topupPrice ? (
                  <RetailCard className="p-6 bg-surface-light">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">Base Price:</span>
                        <span className="text-text-primary font-semibold">
                          {topupBase.toFixed(2)} {topupCurrency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-text-secondary">
                          {topupTaxRate !== null ? `Tax (${topupTaxRate}%)` : 'Tax'}
                        </span>
                        <span className="text-text-primary font-semibold">
                          {topupTaxRate !== null
                            ? `${topupTax.toFixed(2)} ${topupCurrency}`
                            : 'Calculated at checkout'}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-border">
                        <div className="flex justify-between items-center">
                          <span className="text-base font-semibold text-text-primary">Total:</span>
                          <span className="text-xl font-bold text-accent">
                            {topupTotal.toFixed(2)} {topupCurrency}
                          </span>
                        </div>
                      </div>
                      {topupPrice?.taxTreatment && (
                        <p className="text-xs text-text-tertiary">
                          Tax treatment: {topupPrice.taxTreatment.replace(/_/g, ' ')}
                        </p>
                      )}
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
              <Select
                value={selectedCurrency}
                onValueChange={(value) => {
                  setSelectedCurrency(value);
                  setCurrencyTouched(true);
                }}
              >
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

        {/* Invoices */}
        <RetailCard className="p-6">
          <h2 className="text-2xl font-bold text-text-primary mb-6">Invoices</h2>

          {invoicesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={History}
              title="No invoices yet"
              description="Invoices will appear here after successful subscription payments."
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
                        Invoice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {invoice.issuedAt
                            ? format(new Date(invoice.issuedAt), 'MMM d, yyyy')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {invoice.invoiceNumber || invoice.stripeInvoiceId?.slice(-8) || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {invoice.total?.toFixed(2) || '0.00'} {invoice.currency || currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            status={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'danger'}
                            label={invoice.status || 'unknown'}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                          {invoice.hostedInvoiceUrl ? (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invoicesPagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    Showing {((invoicesPagination.page - 1) * invoicesPagination.pageSize) + 1} to{' '}
                    {Math.min(invoicesPagination.page * invoicesPagination.pageSize, invoicesPagination.total)} of{' '}
                    {invoicesPagination.total} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                      disabled={!invoicesPagination.hasPrevPage || invoicesLoading}
                    >
                      Previous
                    </Button>
                    <div className="text-sm text-text-secondary">
                      Page {invoicesPagination.page} of {invoicesPagination.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInvoicePage((p) => Math.min(invoicesPagination.totalPages, p + 1))}
                      disabled={!invoicesPagination.hasNextPage || invoicesLoading}
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
    </RetailPageLayout>
  );
}

/**
 * Billing Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <RetailPageLayout>
          <div className="space-y-6">
            <RetailPageHeader
              title="Billing"
              description="Manage your SMS credits and subscription"
            />
            <RetailCard className="p-6">
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
              </div>
            </RetailCard>
          </div>
        </RetailPageLayout>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
