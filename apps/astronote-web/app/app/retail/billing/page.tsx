'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/retail/api/billing';
import { subscriptionsApi } from '@/src/lib/retail/api/subscriptions';
import api from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Plus,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type RetailInvoice = {
  id: number;
  stripeInvoiceId: string;
  invoiceNumber?: string | null;
  total?: number | null;
  currency?: string | null;
  hostedInvoiceUrl?: string | null;
  pdfUrl?: string | null;
  status?: string | null;
  issuedAt?: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type RetailInvoicesResponse = {
  invoices: RetailInvoice[];
  pagination: Pagination;
};

type RetailBillingLedgerTxn = {
  id: number;
  type: string;
  amount: number;
  currency: string;
  creditsAdded: number;
  status: string;
  createdAt: string;
  stripeSessionId?: string | null;
  stripePaymentId?: string | null;
};

type RetailBillingHistoryResponse = {
  transactions: RetailBillingLedgerTxn[];
  pagination: Pagination;
};

const SUPPORTED_CURRENCIES = ['EUR'] as const;
type BillingCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const normalizeCurrency = (value?: string | null): BillingCurrency | null => {
  if (!value) return null;
  const upper = value.toUpperCase();
  return SUPPORTED_CURRENCIES.includes(upper as BillingCurrency) ? (upper as BillingCurrency) : null;
};

const currencySymbol = (currency: string) => (String(currency).toUpperCase() === 'USD' ? '$' : '€');

const formatAmount = (amount: number, currency: string) =>
  `${currencySymbol(currency)}${amount.toFixed(2)}`;

const getTenantStorageKey = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('accessToken');
  if (!token) return 'retail_billing_currency';
  const payload = token.split('.')[1];
  if (!payload) return 'retail_billing_currency';
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    const tenantId = decoded?.sub || decoded?.userId || decoded?.id;
    if (tenantId) {
      return `retail_billing_currency_${tenantId}`;
    }
  } catch {
    return 'retail_billing_currency';
  }
  return 'retail_billing_currency';
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

function BillingHeader({
  subscription,
  credits,
  currency,
}: {
  subscription: {
    active?: boolean
    planType?: string | null
    status?: string | null
    interval?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
    lastBillingError?: string | null
    plan?: {
      priceEur?: number
      priceUsd?: number
      freeCredits?: number
    } | null
  }
  credits: number
  currency: BillingCurrency
}) {
  const status = subscription?.status || (subscription?.active ? 'active' : 'inactive');
  const isActive = status === 'active';
  const planType = subscription?.planType;
  const interval = subscription?.interval;
  const intervalLabel = interval === 'year' ? 'Yearly' : interval === 'month' ? 'Monthly' : null;
  const planLabel = intervalLabel ? `${intervalLabel} Plan` : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Plan');
  const statusLabel = status ? status.replace(/_/g, ' ') : 'inactive';
  const includedCredits = typeof subscription?.plan?.freeCredits === 'number'
    ? subscription.plan.freeCredits
    : interval === 'month'
      ? 300
      : interval === 'year'
        ? 1500
        : null;
  const planPrice = typeof subscription?.plan?.priceEur === 'number'
    ? subscription.plan.priceEur
    : interval === 'month'
      ? 40
      : interval === 'year'
        ? 240
        : null;
  const statusTone = isActive
    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
    : status === 'past_due' || status === 'unpaid'
      ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
      : 'bg-red-500/10 text-red-400 border border-red-500/20';

  return (
    <RetailCard className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Billing & Subscription</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${statusTone}`}>
          {statusLabel}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-sm text-text-secondary">Wallet Balance</span>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {credits?.toLocaleString() || 0} credits
          </div>
        </div>
        <div>
          <span className="text-sm text-text-secondary">Current Plan</span>
          <div className="text-lg font-medium text-text-primary mt-1">
            {planLabel}
          </div>
          {planPrice !== null && interval && (
            <div className="text-sm text-text-secondary mt-1">
              Current plan: {intervalLabel} {currencySymbol(currency)}
              {planPrice.toFixed(0)}
            </div>
          )}
          {includedCredits !== null && (
            <div className="text-xs text-text-tertiary mt-1">
              Includes {includedCredits.toLocaleString()} credits per paid cycle
            </div>
          )}
        </div>
        <div>
          <span className="text-sm text-text-secondary">Next Renewal</span>
          {subscription?.currentPeriodEnd && (
            <div className="text-lg font-medium text-text-primary mt-1">
              {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
            </div>
          )}
          {!subscription?.currentPeriodEnd && (
            <div className="text-lg font-medium text-text-primary mt-1">—</div>
          )}
          {subscription?.currentPeriodEnd && (
            <div className="text-xs text-text-tertiary mt-1">
              {subscription.cancelAtPeriodEnd ? 'Cancels at period end' : 'Renews automatically'}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 bg-surface-light border border-border rounded-lg p-3">
        <p className={`text-sm ${isActive ? 'text-text-secondary' : 'text-yellow-400'}`}>
          Credits accumulate and never expire; spending requires an active subscription.
        </p>
      </div>
      {subscription?.lastBillingError && (
        <div className="mt-3 text-xs text-red-400">
          Last billing error: {subscription.lastBillingError}
        </div>
      )}
    </RetailCard>
  );
}

function BillingAttentionBanner({
  status,
  lastBillingError,
  onManagePayment,
  onRefresh,
  isRefreshing,
  isPortalLoading,
}: {
  status?: string | null
  lastBillingError?: string | null
  onManagePayment: () => void
  onRefresh: () => void
  isRefreshing: boolean
  isPortalLoading: boolean
}) {
  const isPastDue = status === 'past_due' || status === 'unpaid';
  if (!isPastDue) return null;

  const title = status === 'past_due' ? 'Billing attention required' : 'Payment failed';
  const description = status === 'past_due'
    ? 'Your last payment is past due. Update your payment method to keep your subscription active.'
    : 'Your last payment attempt failed. Update your payment method to restore access.';

  return (
    <RetailCard className="border-yellow-500/20 bg-yellow-500/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">{title}</div>
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Credits accumulate and never expire; spending requires an active subscription.
            </p>
            {lastBillingError && (
              <p className="mt-2 text-xs text-text-tertiary">
                Last billing error: {lastBillingError}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onManagePayment}
            disabled={isPortalLoading}
            variant="outline"
          >
            {isPortalLoading ? 'Opening...' : 'Update payment method'}
          </Button>
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh from Stripe'}
          </Button>
        </div>
      </div>
    </RetailCard>
  );
}

function SubscriptionCard({
  subscription,
  currency,
  onRefresh,
  isRefreshing,
}: {
  subscription: {
    active?: boolean
    planType?: string | null
    status?: string | null
    interval?: 'month' | 'year' | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
    pendingChange?: any
    allowedActions?: string[] | null
    availableOptions?: Array<{ planCode: string; interval: string; currency: string }> | null
    plan?: {
      freeCredits?: number
      priceEur?: number
      priceUsd?: number
    } | null
  }
  currency: BillingCurrency
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const switchKeysRef = useRef<Record<string, string>>({});
  const cancelKeyRef = useRef<string | null>(null);

  const status = subscription?.status || (subscription?.active ? 'active' : 'inactive');
  const isActive = status === 'active';
  const isPastDue = status === 'past_due' || status === 'unpaid';
  const isCanceled = status === 'canceled' || status === 'inactive';
  const interval = subscription?.interval;
  const planType = subscription?.planType;
  const intervalLabel = interval === 'year' ? 'Yearly' : interval === 'month' ? 'Monthly' : null;
  const planLabel = intervalLabel ? `${intervalLabel} Plan` : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Plan');
  const planPrice = typeof subscription?.plan?.priceEur === 'number'
    ? subscription.plan.priceEur
    : interval === 'month'
      ? 40
      : interval === 'year'
        ? 240
        : null;
  const pendingIntervalLabel = subscription?.pendingChange?.interval === 'year'
    ? 'Yearly'
    : subscription?.pendingChange?.interval === 'month'
      ? 'Monthly'
      : null;
  const pendingPlanLabel = pendingIntervalLabel
    ? `${pendingIntervalLabel} Plan`
    : subscription?.pendingChange?.planCode
      ? String(subscription.pendingChange.planCode).charAt(0).toUpperCase() + String(subscription.pendingChange.planCode).slice(1)
      : 'Plan';

  const intervalOptions = [
    {
      interval: 'month' as const,
      planType: 'starter',
      title: 'Monthly',
      description: `${currencySymbol(currency)}40/month · Includes 300 credits per paid cycle`,
    },
    {
      interval: 'year' as const,
      planType: 'pro',
      title: 'Yearly',
      description: `${currencySymbol(currency)}240/year · Includes 1500 credits per paid cycle`,
    },
  ];

  const subscribeMutation = useMutation({
    mutationFn: async (planType: string) => {
      const res = await subscriptionsApi.subscribe({ planType, currency });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl || data.url) {
        window.location.href = data.checkoutUrl || data.url!;
      } else {
        toast.error('No checkout URL received');
      }
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to initiate subscription';

      if (code === 'ALREADY_SUBSCRIBED') {
        toast.error('You already have an active subscription');
      } else {
        toast.error(message);
      }
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (targetPlan: 'starter' | 'pro') => {
      if (!switchKeysRef.current[targetPlan]) {
        switchKeysRef.current[targetPlan] = createIdempotencyKey();
      }
      const res = await subscriptionsApi.switch({
        targetPlan,
        currency,
        idempotencyKey: switchKeysRef.current[targetPlan],
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      // Parity: upgrade may require checkout; scheduled downgrades should not pretend to be immediate.
      const checkoutUrl = data?.checkoutUrl || data?.url;
      if (data?.changeMode === 'checkout' && checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
      queryClient.invalidateQueries({ queryKey: ['retail-subscription-current'] });

      if (data?.changeMode === 'scheduled') {
        toast.success(data?.message || 'Plan change scheduled');
      } else {
        toast.success(data?.message || 'Subscription updated');
      }
    },
    onSettled: (_data, _error, targetPlan) => {
      if (targetPlan) {
        delete switchKeysRef.current[targetPlan];
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update subscription';
      toast.error(message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelKeyRef.current) {
        cancelKeyRef.current = createIdempotencyKey();
      }
      const res = await subscriptionsApi.cancel({
        cancelAtPeriodEnd: true,
        idempotencyKey: cancelKeyRef.current,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
      queryClient.invalidateQueries({ queryKey: ['retail-subscription-current'] });
      toast.success('Cancellation scheduled at period end');
    },
    onSettled: () => {
      cancelKeyRef.current = null;
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to cancel subscription';
      toast.error(message);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.resume();
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
      queryClient.invalidateQueries({ queryKey: ['retail-subscription-current'] });
      toast.success('Subscription resumed');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to resume subscription';
      toast.error(message);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.getPortal();
      return res.data;
    },
    onSuccess: (data) => {
      if (data.portalUrl || data.url) {
        const target = data.portalUrl || data.url!;
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('No portal URL received from server');
      }
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to load customer portal';

      if (code === 'MISSING_CUSTOMER_ID') {
        toast.error('No payment account found. Please subscribe to a plan first.');
      } else {
        toast.error(message);
      }
    },
  });

  const handleSubscribe = (plan: string) => {
    setSelectedPlan(plan);
    subscribeMutation.mutate(plan);
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  const allowed = Array.isArray(subscription?.allowedActions) ? subscription.allowedActions : null;
  const canSwitch = allowed ? allowed.includes('switchInterval') || allowed.includes('changePlan') : true;
  const canCancel = allowed ? allowed.includes('cancelAtPeriodEnd') : true;
  const canResume = allowed ? allowed.includes('resumeSubscription') : true;
  const hasPendingChange = Boolean(subscription?.pendingChange);

  if (isActive) {
    return (
      <RetailCard>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-text-primary">
            Current Subscription: {planLabel}
          </h3>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Status: <span className="text-text-primary capitalize">{status.replace(/_/g, ' ')}</span>
        </p>
        {planPrice !== null && interval && (
          <div className="text-xs text-text-tertiary mb-2">
            Current plan price: {currencySymbol(currency)}
            {planPrice.toFixed(0)} / {interval === 'year' ? 'year' : 'month'}
          </div>
        )}
        {subscription?.pendingChange?.effectiveAt && (
          <div className="text-xs text-text-tertiary mb-2">
            Pending change: {pendingPlanLabel} effective{' '}
            {format(new Date(subscription.pendingChange.effectiveAt), 'MMM d, yyyy')}
          </div>
        )}
        {subscription?.plan?.freeCredits && (
          <div className="text-xs text-text-tertiary mb-4">
            Includes {subscription.plan.freeCredits.toLocaleString()} credits per paid cycle.
          </div>
        )}
        {subscription?.currentPeriodEnd && (
          <div className="text-xs text-text-tertiary mb-4">
            Renews {format(new Date(subscription.currentPeriodEnd), 'MMM d, yyyy')}
            {subscription.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => switchMutation.mutate('starter')}
            disabled={switchMutation.isPending || interval === 'month' || !canSwitch || hasPendingChange}
            variant="outline"
          >
            Switch to Monthly
          </Button>
          <Button
            onClick={() => switchMutation.mutate('pro')}
            disabled={switchMutation.isPending || interval === 'year' || !canSwitch || hasPendingChange}
            variant="outline"
          >
            Switch to Yearly
          </Button>
          <Button
            onClick={handleManageSubscription}
            disabled={portalMutation.isPending}
            variant="outline"
          >
            {portalMutation.isPending ? 'Loading...' : 'Manage Payment Method'}
          </Button>
          <Button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending || subscription.cancelAtPeriodEnd || !canCancel}
            variant="outline"
          >
            {cancelMutation.isPending ? 'Scheduling...' : 'Cancel at Period End'}
          </Button>
          {subscription.cancelAtPeriodEnd && (
            <Button
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending || !canResume}
              variant="outline"
            >
              {resumeMutation.isPending ? 'Resuming...' : 'Resume Subscription'}
            </Button>
          )}
        </div>
      </RetailCard>
    );
  }

  return (
    <RetailCard>
      <div className="flex items-center gap-2 mb-4">
        <XCircle className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-text-primary">
          {isPastDue ? 'Payment requires attention' : 'Activate a Plan'}
        </h3>
      </div>
      {isPastDue ? (
        <p className="text-sm text-text-secondary mb-6">
          Your subscription is on hold until the payment issue is resolved. Update your payment
          method or refresh Stripe to retry.
        </p>
      ) : (
        <div className="mb-6 space-y-2">
          <p className="text-sm text-text-secondary">
            {isCanceled
              ? 'Your credits are safe and never expire, but sending is disabled until you activate a subscription.'
              : 'Choose a subscription plan to start sending campaigns. Monthly includes 300 credits per paid cycle. Yearly includes 1500 credits per paid cycle.'}
          </p>
          {isCanceled && (
            <p className="text-xs text-text-tertiary">
              Credits accumulate and never expire; spending requires an active subscription.
            </p>
          )}
        </div>
      )}
      {isPastDue && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            onClick={handleManageSubscription}
            disabled={portalMutation.isPending}
            variant="outline"
          >
            {portalMutation.isPending ? 'Opening...' : 'Update payment method'}
          </Button>
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh from Stripe'}
          </Button>
        </div>
      )}
      {!isPastDue && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intervalOptions.map((option) => (
              <RetailCard key={option.interval} variant="subtle" hover>
                <h4 className="font-semibold text-text-primary mb-2">{option.title}</h4>
                <p className="text-sm text-text-secondary mb-4">{option.description}</p>
                <Button
                  onClick={() => handleSubscribe(option.planType)}
                  disabled={subscribeMutation.isPending}
                  className="w-full"
                >
                  {subscribeMutation.isPending && selectedPlan === option.planType
                    ? 'Processing...'
                    : `${isCanceled ? 'Activate' : 'Subscribe'} ${option.title}`}
                </Button>
              </RetailCard>
            ))}
          </div>
          <div className="mt-4">
            <Button
              onClick={handleManageSubscription}
              disabled={portalMutation.isPending}
              variant="outline"
            >
              {portalMutation.isPending ? 'Loading...' : 'Manage Payment Method'}
            </Button>
          </div>
        </>
      )}
    </RetailCard>
  );
}

function CreditTopupCard({ currency }: { currency: BillingCurrency }) {
  const [selectedCredits, setSelectedCredits] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: tiersData, isLoading: tiersLoading, error: tiersError } = useQuery({
    queryKey: ['retail-topup-tiers', currency],
    queryFn: async () => {
      const res = await billingApi.getTopupTiers(currency);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const tiers = useMemo(
    () => (Array.isArray(tiersData?.tiers) ? tiersData.tiers : []),
    [tiersData?.tiers],
  );

  useEffect(() => {
    if (!tiers.length) return;
    if (selectedCredits && tiers.some((tier) => tier.credits === selectedCredits)) {
      return;
    }
    setSelectedCredits(tiers[0].credits);
  }, [tiers, selectedCredits]);

  const selectedTier = tiers.find((tier) => tier.credits === selectedCredits) || null;

  const { data: calculatedTopup } = useQuery({
    queryKey: ['retail-topup-calc', currency, selectedCredits],
    queryFn: async () => {
      if (!selectedCredits) {
        throw new Error('Credits are required');
      }
      const res = await billingApi.calculateTopup(selectedCredits, currency);
      return res.data;
    },
    enabled: Boolean(selectedCredits),
    staleTime: 60 * 1000,
  });

  const topupMutation = useMutation({
    mutationFn: async ({ credits }: { credits: number }) => {
      if (!credits || !Number.isInteger(credits) || credits <= 0) {
        throw new Error('Credits must be a positive whole number');
      }
      const res = await billingApi.topup({ credits, currency });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
      queryClient.invalidateQueries({ queryKey: ['retail-subscription-current'] });
      if (data.checkoutUrl || data.url) {
        window.location.href = data.checkoutUrl || data.url!;
      } else {
        toast.error('No checkout URL received');
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to initiate credit top-up';
      toast.error(message);
    },
    retry: false,
  });

  const handleTopup = () => {
    if (!selectedTier) return;
    const displayPrice = totalPrice !== null
      ? formatAmount(totalPrice, currency)
      : formatAmount(selectedTier.amount, selectedTier.currency);
    const vatLine = vatAmount !== undefined && vatAmount !== null
      ? ` Includes VAT ${currencySymbol(currency)}${vatAmount.toFixed(2)}.`
      : '';
    const confirmMessage = `You’re purchasing: ${displayPrice} top-up → +${selectedTier.credits.toLocaleString()} credits.${vatLine}\nProceed to Stripe Checkout?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }
    topupMutation.mutate({ credits: selectedTier.credits });
  };

  const priceBreakdown = calculatedTopup ?? selectedTier?.priceBreakdown ?? null;
  const totalPrice = priceBreakdown?.priceWithVat ?? selectedTier?.amount ?? null;
  const vatAmount = priceBreakdown?.vatAmount;

  return (
    <RetailCard>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Buy Credits</h3>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Credits accumulate and never expire; spending requires an active subscription.
      </p>
      <div className="space-y-4">
        {tiersLoading ? (
          <div className="h-20 rounded bg-surface-light animate-pulse" />
        ) : tiersError ? (
          <p className="text-xs text-text-tertiary text-center">
            Failed to load top-up options. Please try again.
          </p>
        ) : tiers.length === 0 ? (
          <p className="text-xs text-text-tertiary text-center">
            No top-up options available at the moment.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="creditPack" className="block text-sm font-medium text-text-secondary mb-2">
                Select Credits
              </label>
              <Select
                value={selectedCredits ? String(selectedCredits) : ''}
                onValueChange={(value) => setSelectedCredits(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Credits" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.credits} value={String(tier.credits)}>
                      {tier.credits.toLocaleString()} credits · {formatAmount(tier.amount, tier.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-surface-light rounded-lg p-4">
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <span>Credits:</span>
                <span className="font-medium text-text-primary">
                  {selectedTier ? selectedTier.credits.toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-text-primary pt-2 border-t border-border">
                <span>Total:</span>
                <span>
                  {totalPrice !== null ? formatAmount(totalPrice, currency) : '—'}
                </span>
              </div>
              {vatAmount !== undefined && vatAmount !== null && (
                <div className="mt-2 text-xs text-text-tertiary">
                  Includes VAT {currencySymbol(currency)}
                  {vatAmount.toFixed(2)}
                </div>
              )}
            </div>
            <Button
              onClick={handleTopup}
              disabled={!selectedTier || topupMutation.isPending}
              className="w-full"
              size="lg"
            >
              {topupMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Buy {selectedTier ? selectedTier.credits.toLocaleString() : ''} Credits
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </RetailCard>
  );
}

function TransactionsTable({ transactions, isLoading }: { transactions: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <RetailCard>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Wallet activity (credits)</h3>
          <p className="text-sm text-text-secondary">
            Credits added, spent, or refunded inside your wallet.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface-light rounded animate-pulse"></div>
          ))}
        </div>
      </RetailCard>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <RetailCard>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Wallet activity (credits)</h3>
          <p className="text-sm text-text-secondary">
            Credits added, spent, or refunded inside your wallet.
          </p>
        </div>
        <p className="text-sm text-text-secondary">No transactions yet.</p>
      </RetailCard>
    );
  }

  return (
    <RetailCard>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">Wallet activity (credits)</h3>
        <p className="text-sm text-text-secondary">
          Credits added, spent, or refunded inside your wallet.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-light">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {transactions.map((txn) => (
              <tr key={txn.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                  {txn.createdAt ? format(new Date(txn.createdAt), 'MMM d, yyyy HH:mm') : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {txn.type === 'credit' ? (
                      <ArrowUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <ArrowDown className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm text-text-primary capitalize">{txn.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`text-sm font-medium ${
                      txn.type === 'credit' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {txn.type === 'credit' ? '+' : '-'}
                    {Math.abs(txn.amount || 0).toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                  {txn.reason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RetailCard>
  );
}

function InvoicesTable({ invoices, isLoading }: { invoices: RetailInvoice[]; isLoading: boolean }) {
  return (
    <RetailCard>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-text-primary">Invoices</h3>
          <div className="text-xs text-text-tertiary">DB-first • Stripe fallback</div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-light rounded animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-text-secondary">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Links
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.stripeInvoiceId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {inv.issuedAt ? format(new Date(inv.issuedAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {inv.status || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {typeof inv.total === 'number' && inv.currency
                        ? formatAmount(inv.total, inv.currency)
                        : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-3">
                        {inv.hostedInvoiceUrl ? (
                          <a
                            className="text-accent hover:underline"
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Hosted
                          </a>
                        ) : (
                          <span className="text-text-tertiary">Hosted</span>
                        )}
                        {inv.pdfUrl ? (
                          <a
                            className="text-accent hover:underline"
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            PDF
                          </a>
                        ) : (
                          <span className="text-text-tertiary">PDF</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RetailCard>
  );
}

function BillingHistoryTable({
  transactions,
  isLoading,
}: {
  transactions: RetailBillingLedgerTxn[];
  isLoading: boolean;
}) {
  return (
    <RetailCard>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Payments</h3>
            <p className="text-sm text-text-secondary">
              Money transactions processed via Stripe (subscriptions and top-ups).
            </p>
          </div>
          <div className="text-xs text-text-tertiary">Subscription • Included credits • Top-ups</div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-light rounded animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-text-secondary">No payment history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {t.createdAt ? format(new Date(t.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {t.type || 'billing'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {formatAmount(t.amount || 0, t.currency || 'EUR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {t.creditsAdded ? `+${t.creditsAdded.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {t.status || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RetailCard>
  );
}

export default function RetailBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [invoicePage] = useState(1);
  const [billingHistoryPage] = useState(1);
  const [activityTab, setActivityTab] = useState<'wallet' | 'payments'>('wallet');
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('EUR');
  const [currencyStorageKey, setCurrencyStorageKey] = useState<string | null>(null);
  const hasStoredSelection = useRef(false);
  const queryClient = useQueryClient();

  const { data: summaryData, isLoading: balanceLoading, error: balanceError } = useQuery({
    queryKey: ['retail-billing-summary'],
    queryFn: async () => {
      const res = await billingApi.getSummary();
      return res.data;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Backend-driven subscription contract (Shopify parity): allowedActions + availableOptions + pendingChange.
  const { data: subscriptionCurrent } = useQuery({
    queryKey: ['retail-subscription-current'],
    queryFn: async () => {
      const res = await subscriptionsApi.getCurrent();
      return res.data as any;
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    setCurrencyStorageKey(getTenantStorageKey());
  }, []);

  useEffect(() => {
    if (!currencyStorageKey) return;
    const stored = normalizeCurrency(localStorage.getItem(currencyStorageKey));
    if (stored) {
      hasStoredSelection.current = true;
      setSelectedCurrency(stored);
      return;
    }

    if (!hasStoredSelection.current) {
      const fallback = normalizeCurrency(summaryData?.billingCurrency);
      if (fallback) {
        setSelectedCurrency(fallback);
      }
    }
  }, [currencyStorageKey, summaryData?.billingCurrency]);

  const {
    data: transactionsData,
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: ['retail-transactions', transactionsPage],
    queryFn: async () => {
      const res = await billingApi.getTransactions({ page: transactionsPage, pageSize: 20 });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['retail-invoices', invoicePage],
    queryFn: async () => {
      const res = await api.get<RetailInvoicesResponse>(endpoints.billing.invoices, {
        params: { page: invoicePage, pageSize: 20 },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const { data: billingHistoryData, isLoading: billingHistoryLoading } = useQuery({
    queryKey: ['retail-billing-history', billingHistoryPage],
    queryFn: async () => {
      const res = await api.get<RetailBillingHistoryResponse>(endpoints.billing.billingHistory, {
        params: { page: billingHistoryPage, pageSize: 20 },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(endpoints.subscriptions.reconcile);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['retail-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['retail-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['retail-billing-history'] });
      queryClient.invalidateQueries({ queryKey: ['retail-subscription-current'] });
      toast.success('Refreshed from Stripe');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to refresh from Stripe';
      toast.error(msg);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.getPortal();
      return res.data;
    },
    onSuccess: (data) => {
      if (data.portalUrl || data.url) {
        const target = data.portalUrl || data.url!;
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('No portal URL received from server');
      }
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to load customer portal';

      if (code === 'MISSING_CUSTOMER_ID') {
        toast.error('No payment account found. Please subscribe to a plan first.');
      } else {
        toast.error(message);
      }
    },
  });

  // Portal return: reconcile once and then clean the URL.
  useEffect(() => {
    if (searchParams.get('fromPortal') === 'true') {
      reconcileMutation.mutate();
      router.replace('/app/retail/billing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  // Payment success return: show toast once and clean the URL.
  useEffect(() => {
    if (searchParams.get('paymentSuccess') === '1') {
      toast.success('Payment processed successfully');
      router.replace('/app/retail/billing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);
  const handleCurrencyChange = (value: string) => {
    const normalized = normalizeCurrency(value) || 'EUR';
    setSelectedCurrency(normalized);
    if (currencyStorageKey) {
      localStorage.setItem(currencyStorageKey, normalized);
    }
    hasStoredSelection.current = true;
  };

  const currencySelector = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => reconcileMutation.mutate()}
        disabled={reconcileMutation.isPending}
      >
        {reconcileMutation.isPending ? 'Refreshing…' : 'Refresh from Stripe'}
      </Button>
      {SUPPORTED_CURRENCIES.length > 1 ? (
        <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EUR">EUR (€)</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="px-3 py-2 rounded-md border border-border bg-surface-light text-sm text-text-secondary">
          Currency: EUR
        </div>
      )}
    </div>
  );

  if (balanceLoading) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Billing"
            description="Manage your subscription and credits"
          />
          <div className="mb-4 h-8 w-48 animate-pulse rounded bg-surface-light"></div>
          <div className="h-32 animate-pulse rounded bg-surface-light"></div>
        </div>
      </RetailPageLayout>
    );
  }

  if (balanceError) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Billing"
            description="Manage your subscription and credits"
          />
          <RetailCard variant="danger">
            <div className="text-sm text-red-400">Error loading billing information</div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  const subscription =
    subscriptionCurrent || summaryData?.subscription || { active: false, planType: null };
  const credits = summaryData?.totalCredits ?? (summaryData?.credits || 0);
  const subscriptionStatus = subscription?.status || (subscription?.active ? 'active' : 'inactive');

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Billing"
          description="Manage your subscription and credits"
          actions={currencySelector}
        />
        <div className="text-sm text-text-secondary">
          After payment we automatically verify and reconcile so credits and invoices refresh in a few moments.
        </div>

        <BillingAttentionBanner
          status={subscriptionStatus}
          lastBillingError={subscription?.lastBillingError}
          onManagePayment={() => portalMutation.mutate()}
          onRefresh={() => reconcileMutation.mutate()}
          isRefreshing={reconcileMutation.isPending}
          isPortalLoading={portalMutation.isPending}
        />

        <BillingHeader subscription={subscription} credits={credits} currency={selectedCurrency} />

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SubscriptionCard
            subscription={subscription}
            currency={selectedCurrency}
            onRefresh={() => reconcileMutation.mutate()}
            isRefreshing={reconcileMutation.isPending}
          />
          <CreditTopupCard currency={selectedCurrency} />
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setActivityTab('wallet')}
              variant={activityTab === 'wallet' ? 'default' : 'outline'}
              size="sm"
            >
              Wallet activity (credits)
            </Button>
            <Button
              onClick={() => setActivityTab('payments')}
              variant={activityTab === 'payments' ? 'default' : 'outline'}
              size="sm"
            >
              Payments
            </Button>
          </div>
          {activityTab === 'wallet' ? (
            <>
              <TransactionsTable
                transactions={transactionsData?.items || []}
                isLoading={transactionsLoading}
              />
              {transactionsData && transactionsData.total > 20 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    Showing {(transactionsPage - 1) * 20 + 1} to{' '}
                    {Math.min(transactionsPage * 20, transactionsData.total)} of {transactionsData.total}{' '}
                    transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                      disabled={transactionsPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setTransactionsPage((p) => p + 1)}
                      disabled={transactionsPage * 20 >= transactionsData.total}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <BillingHistoryTable
              transactions={billingHistoryData?.transactions || []}
              isLoading={billingHistoryLoading}
            />
          )}
        </div>

        <div className="mb-6">
          <InvoicesTable invoices={invoicesData?.invoices || []} isLoading={invoicesLoading} />
        </div>
      </div>
    </RetailPageLayout>
  );
}
