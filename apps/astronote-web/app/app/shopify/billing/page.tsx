'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useBillingBalance } from '@/src/features/shopify/billing/hooks/useBillingBalance';
import { useBillingSummary } from '@/src/features/shopify/billing/hooks/useBillingSummary';
import { useSubscriptionStatus } from '@/src/features/shopify/billing/hooks/useSubscriptionStatus';
import { useBillingProfile } from '@/src/features/shopify/billing/hooks/useBillingProfile';
import { useBillingInvoices } from '@/src/features/shopify/billing/hooks/useBillingInvoices';
import {
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
  useCancelScheduledSubscription,
  useChangeScheduledSubscription,
} from '@/src/features/shopify/billing/hooks/useSubscriptionMutations';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  deriveUIState,
  getAvailableActions,
  getPlanActionLabel,
  getPlanChangeMessage,
  isActionDisabled,
  type BillingAction,
  type BillingUIState,
} from '@/src/features/shopify/billing/utils/billingActionMatrix';

/**
 * Billing Page Content
 */
function BillingPageContent() {
  const searchParams = useSearchParams();
  const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
  const [topupCredits, setTopupCredits] = useState<string>('');
  const [invoicePage, setInvoicePage] = useState(1);
  const pageSize = 20;
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: BillingAction | null;
    onConfirm: () => void;
      }>({ open: false, action: null, onConfirm: () => {} });

  // Fetch data
  const { data: balanceData } = useBillingBalance();
  const { data: billingSummary, isLoading: summaryLoading } = useBillingSummary();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscriptionStatus();
  const { data: billingProfile } = useBillingProfile();
  const { data: invoicesData, isLoading: invoicesLoading } = useBillingInvoices({ page: invoicePage, pageSize });

  // Mutations
  const createTopup = useCreateTopup();
  const subscribe = useSubscribe();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const getPortal = useGetPortal();
  const switchInterval = useSwitchInterval();
  const reconcileSubscription = useReconcileSubscription();
  const cancelScheduledSubscription = useCancelScheduledSubscription();
  const changeScheduledSubscription = useChangeScheduledSubscription();
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

  // Normalize data
  const summary = billingSummary || null;
  const billingCurrency =
    summary?.billingCurrency ||
    (summary?.subscription as any)?.billingCurrency ||
    billingProfile?.currency ||
    balanceData?.currency ||
    'EUR';
  const walletBalance = summary?.credits?.balance || balanceData?.credits || balanceData?.balance || 0;
  const currency = summary?.credits?.currency || balanceData?.currency || billingCurrency || selectedCurrency || 'EUR';
  const currencySymbol = currency === 'USD' ? '$' : '€';
  const showEurPricing = currency === 'EUR';
  // Stripe-as-truth: prefer /subscriptions/status over summary.subscription
  const subscriptionRaw = subscriptionData || summary?.subscription || { status: 'inactive', planType: null, interval: null, active: false };
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
  const allowanceRemaining = allowance?.remainingThisPeriod || 0;
  const availableToSend = (walletBalance || 0) + (allowanceRemaining || 0);
  const invoices = invoicesData?.invoices || [];
  const invoicesPagination = invoicesData?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false };
  const topupPrice = topupPriceData;
  const topupCurrency = topupPrice?.currency || selectedCurrency || currency || 'EUR';
  const topupBase = topupPrice?.basePrice ?? topupPrice?.priceEur ?? 0;
  const topupTax = topupPrice?.taxAmount ?? topupPrice?.vatAmount ?? 0;
  const topupTotal = topupPrice?.totalPrice ?? topupPrice?.priceEurWithVat ?? 0;
  const topupTaxRate = Number.isFinite(topupPrice?.taxRate)
    ? Math.round((topupPrice?.taxRate || 0) * 100)
    : null;

  useEffect(() => {
    if (billingCurrency && billingCurrency !== selectedCurrency) {
      setSelectedCurrency(billingCurrency);
    }
  }, [billingCurrency, selectedCurrency]);

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

  // Derive UI state from subscription (action matrix)
  const uiState: BillingUIState = deriveUIState(subscription);
  // Use backend allowedActions if provided (prevents drift), otherwise compute locally
  const availableActions = getAvailableActions(uiState, subscription?.allowedActions);

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

  // Action handlers with confirmation support
  const handleAction = (action: BillingAction, targetPlanCode?: 'starter' | 'pro', targetInterval?: 'month' | 'year') => {
    // Special handling for switchInterval - determine target interval if not provided
    let finalTargetInterval = targetInterval;
    if (action.id === 'switchInterval' && !finalTargetInterval) {
      // Determine target interval from current state (toggle)
      finalTargetInterval = uiState.currentInterval === 'month' ? 'year' : 'month';
    }

    // Check if action is disabled
    const disabled = isActionDisabled(action.id, uiState, targetPlanCode, finalTargetInterval);
    if (disabled.disabled) {
      toast.error(disabled.reason || 'This action is not available');
      return;
    }

    // If action requires confirmation, show dialog
    if (action.requiresConfirmation && action.confirmationCopy) {
      setConfirmDialog({
        open: true,
        action,
        onConfirm: () => {
          setConfirmDialog({ open: false, action: null, onConfirm: () => {} });
          executeAction(action, targetPlanCode, finalTargetInterval);
        },
      });
      return;
    }

    // Execute immediately
    executeAction(action, targetPlanCode, finalTargetInterval);
  };

  const executeAction = (action: BillingAction, targetPlanCode?: 'starter' | 'pro', targetInterval?: 'month' | 'year') => {
    switch (action.id) {
    case 'subscribe':
      if (targetPlanCode) {
        handleSubscribe(targetPlanCode);
      }
      break;
    case 'changePlan':
      if (targetPlanCode && targetInterval) {
        handleChangePlan(targetPlanCode, targetInterval);
      }
      break;
    case 'cancelScheduledChange':
      cancelScheduledSubscription.mutate();
      break;
    case 'switchInterval':
      if (targetInterval) {
        handleSwitchInterval(targetInterval);
      } else {
        // Toggle current interval based on current state
        const newInterval = uiState.currentInterval === 'month' ? 'year' : 'month';
        handleSwitchInterval(newInterval);
      }
      break;
    case 'cancelAtPeriodEnd':
      handleCancelSubscription();
      break;
    case 'resumeSubscription':
      resumeSubscription.mutate();
      break;
    case 'updatePaymentMethod':
      handleManageSubscription();
      break;
    case 'refreshFromStripe':
      reconcileSubscription.mutate();
      break;
    case 'viewInvoices':
      // Scroll to invoices section (handled by UI)
      break;
    default:
      toast.error('Action not implemented');
    }
  };

  const handleChangePlan = async (planType: 'starter' | 'pro', interval: 'month' | 'year') => {
    try {
      // If a scheduled change exists, modify the scheduled change instead of applying immediately.
      if (uiState.pendingChange) {
        await changeScheduledSubscription.mutateAsync({ planType, interval, currency });
        return;
      }

      // If subscribed, use /subscriptions/switch (which delegates to /subscriptions/update on plan changes)
      if (isSubscriptionActive) {
        await switchInterval.mutateAsync({ planType, interval, currency });
        return;
      }

      // Otherwise create initial subscription
      await subscribe.mutateAsync({ planType, interval, currency });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleSwitchInterval = async (interval: 'month' | 'year') => {
    // Note: Confirmation is handled by handleAction() via ConfirmDialog
    // This function is called after confirmation
    try {
      await switchInterval.mutateAsync({ interval });
      // Status will be refreshed automatically via query invalidation in the mutation hook
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const isLowBalance = availableToSend < 100;

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <AppPageHeader
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
                    Available to send
                  </div>
                  <div className={`text-4xl sm:text-5xl font-bold ${isLowBalance ? 'text-red-500' : 'text-accent'}`}>
                    {availableToSend.toLocaleString()}
                  </div>
                  <div className="text-base text-text-secondary mt-1">Free allowance + wallet credits</div>
                  <div className="mt-2 text-sm text-text-tertiary">
                    Free remaining: <span className="text-text-secondary">{allowanceRemaining.toLocaleString()}</span>
                    {' · '}
                    Wallet credits: <span className="text-text-secondary">{walletBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              {isLowBalance && (
                <div className="flex items-center gap-3 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-500 font-medium">
                    Low available credits. Consider purchasing more credits to continue sending messages.
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
              {/* Action Matrix - Professional Actions Based on State */}
              <div className="space-y-4">
                {/* Status Banners */}
                {uiState.cancelAtPeriodEnd && uiState.effectiveDates.cancelEffectiveDate && (
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-500">
                          Subscription will cancel on {formatDateSafe(uiState.effectiveDates.cancelEffectiveDate)}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          You&apos;ll keep access until then. You can resume anytime before the cancellation date.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {uiState.pendingChange && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-500">
                          Scheduled change to {uiState.pendingChange.planCode} ({uiState.pendingChange.interval}ly)
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          Effective on {formatDateSafe(uiState.pendingChange.effectiveAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {(uiState.status === 'past_due' || uiState.status === 'unpaid') && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-500">
                          Payment required - Your subscription is {uiState.status === 'past_due' ? 'past due' : 'unpaid'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          Please update your payment method to continue service.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons - Responsive Grid */}
                <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                  {availableActions.map((action) => {
                    const disabled = isActionDisabled(action.id, uiState).disabled;
                    const isLoading =
                      (action.id === 'cancelAtPeriodEnd' && cancelSubscription.isPending) ||
                      (action.id === 'resumeSubscription' && resumeSubscription.isPending) ||
                      (action.id === 'switchInterval' && switchInterval.isPending) ||
                      (action.id === 'updatePaymentMethod' && getPortal.isPending) ||
                      (action.id === 'refreshFromStripe' && reconcileSubscription.isPending) ||
                      (action.id === 'subscribe' && subscribe.isPending);

                    return (
                      <Button
                        key={action.id}
                        onClick={() => handleAction(action)}
                        disabled={disabled || isLoading}
                        variant={
                          action.variant === 'link' || action.variant === 'destructive'
                            ? 'ghost'
                            : action.variant === 'default'
                              ? 'default'
                              : 'outline'
                        }
                        className={
                          action.intent === 'danger'
                            ? 'text-red-400 hover:text-red-500'
                            : action.intent === 'primary'
                              ? ''
                              : ''
                        }
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {action.id === 'updatePaymentMethod' && <ExternalLink className="mr-2 h-4 w-4" />}
                            {action.id === 'refreshFromStripe' && <RefreshCw className="mr-2 h-4 w-4" />}
                            {action.label}
                          </>
                        )}
                      </Button>
                    );
                  })}
                </div>
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
                    {getPlanChangeMessage(uiState, 'starter', 'month')}
                  </p>
                  <Button
                    onClick={() => handleAction({ id: 'subscribe', label: 'Subscribe', intent: 'primary', variant: 'default' }, 'starter', 'month')}
                    disabled={subscribe.isPending || (isSubscriptionActive && subscriptionPlan === 'starter' && subscriptionInterval === 'month')}
                    className="w-full"
                    variant={isSubscriptionActive && subscriptionPlan === 'starter' && subscriptionInterval === 'month' ? 'outline' : 'default'}
                  >
                    {getPlanActionLabel(uiState, 'starter', 'month')}
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
                  <p className="text-xs text-text-tertiary mb-4 italic">
                    {getPlanChangeMessage(uiState, 'pro', 'year')}
                  </p>
                  <Button
                    onClick={() => handleAction({ id: 'subscribe', label: 'Subscribe', intent: 'primary', variant: 'default' }, 'pro', 'year')}
                    disabled={subscribe.isPending || (isSubscriptionActive && subscriptionPlan === 'pro' && subscriptionInterval === 'year')}
                    className="w-full"
                    variant={isSubscriptionActive && subscriptionPlan === 'pro' && subscriptionInterval === 'year' ? 'outline' : 'default'}
                  >
                    {getPlanActionLabel(uiState, 'pro', 'year')}
                  </Button>
                </div>
              </RetailCard>
            </div>
          )}
        </RetailCard>

        {/* Billing Details */}
        <RetailCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Billing Details</h2>
              <p className="text-sm text-text-secondary mt-1">
                Billing details are collected securely during checkout and saved automatically.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/app/shopify/billing/settings'}
              >
                Edit Details
              </Button>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={getPortal.isPending}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage in Stripe
              </Button>
            </div>
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

        {/* Invoices-first optimization: credit packs removed from default UI (top-up covers purchases). */}
        {/* Invoices-first optimization: purchase history removed from default UI (Invoices section is the main history surface). */}

        {/* Billing Help & Guidance */}
        <RetailCard className="p-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">Billing Help & Guidance</h2>
            <p className="text-sm text-text-secondary">
              Learn how billing works and get answers to common questions.
            </p>

            <div className="space-y-3">
              {/* How switching plans works */}
              <details className="group rounded-lg border border-border bg-surface-light p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-accent flex-shrink-0" />
                    <h3 className="text-base font-semibold text-text-primary">How switching plans works</h3>
                  </div>
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <strong className="text-text-primary">Upgrades:</strong> When you upgrade to a higher plan (e.g., Starter → Pro), the change takes effect immediately. You&apos;ll be charged a prorated amount for the remainder of your billing period.
                  </p>
                  <p>
                    <strong className="text-text-primary">Downgrades:</strong> Most downgrades take effect immediately. However, if you&apos;re on the Pro Yearly plan and downgrade, the change is scheduled for the end of your yearly term to ensure you get full value.
                  </p>
                  <p>
                    <strong className="text-text-primary">Switching intervals:</strong> When you switch from monthly to yearly billing (or vice versa), the change takes effect immediately. Stripe automatically calculates any proration based on your current usage.
                  </p>
                </div>
              </details>

              {/* When you're charged */}
              <details className="group rounded-lg border border-border bg-surface-light p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-accent flex-shrink-0" />
                    <h3 className="text-base font-semibold text-text-primary">When you&apos;re charged</h3>
                  </div>
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <strong className="text-text-primary">New subscriptions:</strong> You&apos;re charged immediately when you subscribe. Your billing period starts from that moment.
                  </p>
                  <p>
                    <strong className="text-text-primary">Plan changes:</strong> For upgrades and interval switches, you&apos;ll be charged a prorated amount immediately. The proration ensures you only pay for the time you&apos;ve used on each plan.
                  </p>
                  <p>
                    <strong className="text-text-primary">Renewals:</strong> Your subscription automatically renews at the end of each billing period. You&apos;ll be charged the full amount for the next period.
                  </p>
                  <p>
                    <strong className="text-text-primary">Cancellations:</strong> If you cancel, you&apos;ll keep access until the end of your current billing period. No charges occur after that date.
                  </p>
                </div>
              </details>

              {/* Why billing details are needed */}
              <details className="group rounded-lg border border-border bg-surface-light p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-accent flex-shrink-0" />
                    <h3 className="text-base font-semibold text-text-primary">Why we need billing details</h3>
                  </div>
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <strong className="text-text-primary">Legal requirements:</strong> We need your billing address and legal name to comply with tax regulations and provide accurate invoices.
                  </p>
                  <p>
                    <strong className="text-text-primary">VAT/Tax ID:</strong> If you&apos;re a business in the EU (especially Greece), we may need your VAT number (AFM) for tax compliance. This helps ensure correct tax treatment and may reduce your tax burden.
                  </p>
                  <p>
                    <strong className="text-text-primary">Invoice accuracy:</strong> Complete billing details ensure your invoices are accurate and can be used for accounting purposes.
                  </p>
                  <p className="text-xs text-text-tertiary italic">
                    You can update your billing details at any time in the Billing Settings page.
                  </p>
                </div>
              </details>

              {/* How to fix payment issues */}
              <details className="group rounded-lg border border-border bg-surface-light p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <h3 className="text-base font-semibold text-text-primary">How to fix payment issues</h3>
                  </div>
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <strong className="text-text-primary">Payment failed:</strong> If your payment fails, your subscription status will show as &quot;Past Due&quot; or &quot;Unpaid&quot;. Update your payment method immediately to avoid service interruption.
                  </p>
                  <p>
                    <strong className="text-text-primary">Update payment method:</strong> Click &quot;Manage Payment Method&quot; to open the Stripe Customer Portal, where you can update your card, billing address, and payment preferences.
                  </p>
                  <p>
                    <strong className="text-text-primary">Contact support:</strong> If you continue to experience payment issues, please contact our support team. We&apos;re here to help!
                  </p>
                </div>
              </details>

              {/* How to get invoices/receipts */}
              <details className="group rounded-lg border border-border bg-surface-light p-4">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-accent flex-shrink-0" />
                    <h3 className="text-base font-semibold text-text-primary">How to get invoices/receipts</h3>
                  </div>
                  <span className="text-text-tertiary group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <p>
                    <strong className="text-text-primary">View invoices:</strong> All your invoices are listed in the &quot;Invoices&quot; section below. Each invoice shows the date, amount, status, and provides links to view or download.
                  </p>
                  <p>
                    <strong className="text-text-primary">Download PDF:</strong> Click &quot;View&quot; on any invoice to open it in Stripe&apos;s hosted invoice page, where you can download a PDF copy.
                  </p>
                  <p>
                    <strong className="text-text-primary">Email receipts:</strong> Stripe automatically sends email receipts to your billing email address after each successful payment.
                  </p>
                  <p className="text-xs text-text-tertiary italic">
                    Invoices are generated automatically for all subscription payments and top-ups.
                  </p>
                </div>
              </details>
            </div>
          </div>
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

      {/* Confirmation Dialog for Actions */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onClose={() => setConfirmDialog({ open: false, action: null, onConfirm: () => {} })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.action?.label || 'Confirm Action'}
        message={confirmDialog.action?.confirmationCopy || 'Are you sure you want to proceed?'}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={confirmDialog.action?.intent === 'danger' ? 'danger' : 'default'}
        confirmLoading={
          (confirmDialog.action?.id === 'cancelAtPeriodEnd' && cancelSubscription.isPending) ||
          (confirmDialog.action?.id === 'resumeSubscription' && resumeSubscription.isPending) ||
          (confirmDialog.action?.id === 'switchInterval' && switchInterval.isPending) ||
          (confirmDialog.action?.id === 'subscribe' && subscribe.isPending)
        }
      />
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
            <AppPageHeader
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
