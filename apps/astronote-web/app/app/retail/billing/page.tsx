'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { billingApi, type Package } from '@/src/lib/retail/api/billing';
import { subscriptionsApi } from '@/src/lib/retail/api/subscriptions';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Package as PackageIcon,
  ShoppingCart,
  Plus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SUPPORTED_CURRENCIES = ['EUR', 'USD'] as const;
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

function BillingHeader({
  subscription,
  credits,
}: {
  subscription: { active: boolean; planType: string | null }
  credits: number
}) {
  const isActive = subscription?.active === true;
  const planType = subscription?.planType;

  return (
    <RetailCard className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Billing & Subscription</h2>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {isActive ? `Active ${planType || ''} Plan` : 'Inactive'}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-text-secondary">Credits Balance</span>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {credits?.toLocaleString() || 0} credits
          </div>
        </div>
        <div>
          <span className="text-sm text-text-secondary">Subscription Status</span>
          <div className="text-lg font-medium text-text-primary mt-1">
            {isActive ? (
              <span className="text-green-400">Active {planType ? `(${planType})` : ''}</span>
            ) : (
              <span className="text-red-400">Inactive</span>
            )}
          </div>
        </div>
      </div>
      {!isActive && (
        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <p className="text-sm text-yellow-400">
            <strong>Note:</strong> Credits can be purchased at any time, but can only be{' '}
            <strong>used</strong> to send campaigns when you have an active subscription. Subscribe
            to a plan to start sending campaigns.
          </p>
        </div>
      )}
    </RetailCard>
  );
}

function SubscriptionCard({
  subscription,
  currency,
}: {
  subscription: { active: boolean; planType: string | null }
  currency: BillingCurrency
}) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

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

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.getPortal();
      return res.data;
    },
    onSuccess: (data) => {
      if (data.portalUrl || data.url) {
        window.location.assign(data.portalUrl || data.url!);
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

  const isActive = subscription?.active === true;
  const currentPlan = subscription?.planType;

  const handleSubscribe = (planType: string) => {
    setSelectedPlan(planType);
    subscribeMutation.mutate(planType);
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  if (isActive) {
    return (
      <RetailCard>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-text-primary">
            Current Subscription:{' '}
            {currentPlan ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) : 'Active'}
          </h3>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          You have an active subscription. You can manage your subscription, update your plan, or
          cancel from the customer portal.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleManageSubscription}
            disabled={portalMutation.isPending}
            variant="outline"
          >
            {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
          </Button>
        </div>
      </RetailCard>
    );
  }

  return (
    <RetailCard>
      <div className="flex items-center gap-2 mb-4">
        <XCircle className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-text-primary">Subscribe to a Plan</h3>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        Choose a subscription plan to start sending campaigns. All plans include monthly credit
        allocations.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RetailCard variant="subtle" hover>
          <h4 className="font-semibold text-text-primary mb-2">Starter Plan</h4>
          <p className="text-sm text-text-secondary mb-4">Perfect for small businesses</p>
          <Button
            onClick={() => handleSubscribe('starter')}
            disabled={subscribeMutation.isPending}
            className="w-full"
          >
            {subscribeMutation.isPending && selectedPlan === 'starter'
              ? 'Processing...'
              : 'Subscribe to Starter'}
          </Button>
        </RetailCard>
        <RetailCard variant="subtle" hover>
          <h4 className="font-semibold text-text-primary mb-2">Pro Plan</h4>
          <p className="text-sm text-text-secondary mb-4">For growing businesses</p>
          <Button
            onClick={() => handleSubscribe('pro')}
            disabled={subscribeMutation.isPending}
            className="w-full"
          >
            {subscribeMutation.isPending && selectedPlan === 'pro'
              ? 'Processing...'
              : 'Subscribe to Pro'}
          </Button>
        </RetailCard>
      </div>
    </RetailCard>
  );
}

function CreditTopupCard({ currency }: { currency: BillingCurrency }) {
  const creditOptions = [100, 250, 500, 1000, 2000];
  const [selectedCredits, setSelectedCredits] = useState<number>(creditOptions[2]);
  const queryClient = useQueryClient();

  const { data: priceData, isLoading: priceLoading, error: priceError } = useQuery({
    queryKey: ['retail-topup-price', selectedCredits, currency],
    queryFn: async () => {
      const res = await billingApi.calculateTopup(selectedCredits, currency);
      return res.data;
    },
    enabled: Number.isInteger(selectedCredits) && selectedCredits > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
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
    if (!selectedCredits) return;
    topupMutation.mutate({ credits: selectedCredits });
  };

  const totalPrice = typeof priceData?.priceWithVat === 'number'
    ? priceData.priceWithVat
    : typeof priceData?.price === 'number'
      ? priceData.price
      : typeof priceData?.priceEurWithVat === 'number'
        ? priceData.priceEurWithVat
        : typeof priceData?.priceUsdWithVat === 'number'
          ? priceData.priceUsdWithVat
          : null;

  return (
    <RetailCard>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Buy Credits</h3>
      </div>
      <p className="text-sm text-text-secondary mb-4">
        Purchase credits. 1 credit = 1 SMS message. Credits can be purchased regardless of
        subscription status, but can only be <strong>used</strong> with an active subscription.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="creditPack" className="block text-sm font-medium text-text-secondary mb-2">
            Select Credits
          </label>
          <Select
            value={String(selectedCredits)}
            onValueChange={(value) => setSelectedCredits(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Credits" />
            </SelectTrigger>
            <SelectContent>
              {creditOptions.map((credits) => (
                <SelectItem key={credits} value={String(credits)}>
                  {credits.toLocaleString()} credits
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="bg-surface-light rounded-lg p-4">
          <div className="flex justify-between text-sm text-text-secondary mb-1">
            <span>Credits:</span>
            <span className="font-medium text-text-primary">{selectedCredits.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-text-primary pt-2 border-t border-border">
            <span>Total:</span>
            <span>
              {priceLoading
                ? 'Loading...'
                : totalPrice !== null
                  ? formatAmount(totalPrice, currency)
                  : '—'}
            </span>
          </div>
          {priceData?.vatAmount !== undefined && (
            <div className="mt-2 text-xs text-text-tertiary">
              Includes VAT {currencySymbol(currency)}
              {priceData.vatAmount.toFixed(2)}
            </div>
          )}
        </div>
        <Button
          onClick={handleTopup}
          disabled={topupMutation.isPending || priceLoading || !!priceError}
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
              Buy {selectedCredits.toLocaleString()} Credits
            </>
          )}
        </Button>
        {priceError && (
          <p className="text-xs text-text-tertiary text-center">
            Failed to load pricing. Please try again.
          </p>
        )}
      </div>
    </RetailCard>
  );
}

function PackageCard({ pkg, currency }: { pkg: Package; currency: BillingCurrency }) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const purchaseMutation = useMutation({
    mutationFn: async ({
      packageId,
      currency = 'EUR',
      idempotencyKey,
    }: { packageId: number; currency?: string; idempotencyKey?: string }) => {
      const res = await billingApi.purchase({ packageId, currency, idempotencyKey });
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
      const message = error.response?.data?.message || 'Failed to initiate purchase';
      toast.error(message);
      setIsPurchasing(false);
    },
    retry: false,
  });

  const getPrice = (pkg: Package) => {
    if ('priceCents' in pkg && typeof pkg.priceCents === 'number') {
      return (pkg.priceCents / 100).toFixed(2);
    }
    if ('amount' in pkg && typeof pkg.amount === 'number') {
      return pkg.amount.toFixed(2);
    }
    if ('priceEur' in pkg && typeof pkg.priceEur === 'number') {
      return pkg.priceEur.toFixed(2);
    }
    return pkg.price.toFixed(2);
  };

  const getUnits = (pkg: Package) => {
    if ('units' in pkg && pkg.units) {
      return pkg.units;
    }
    return pkg.credits || 0;
  };

  const handlePurchase = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    setIsPurchasing(true);
    purchaseMutation.mutate({
      packageId: Number(pkg.id),
      currency,
      idempotencyKey: idempotencyKeyRef.current || undefined,
    });
  };

  return (
    <RetailCard hover>
      <div className="flex items-center gap-2 mb-3">
        <PackageIcon className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">
          {pkg.displayName || pkg.name || 'Package'}
        </h3>
      </div>
      <div className="mb-4">
        <div className="text-2xl font-bold text-text-primary mb-1">
          {getUnits(pkg).toLocaleString()} credits
        </div>
        <div className="text-lg text-text-secondary">
          {currencySymbol(pkg.currency || currency)}
          {getPrice(pkg)}
        </div>
      </div>
      <Button
        onClick={handlePurchase}
        disabled={isPurchasing || purchaseMutation.isPending || (pkg as any)?.available === false}
        className="w-full"
      >
        {isPurchasing || purchaseMutation.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Purchase
          </>
        )}
      </Button>
      {(pkg as any)?.available === false && (
        <p className="text-xs text-text-tertiary mt-2 text-center">
          Stripe checkout not available for this package
        </p>
      )}
    </RetailCard>
  );
}

function TransactionsTable({ transactions, isLoading }: { transactions: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <RetailCard>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Transaction History</h3>
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
        <h3 className="text-lg font-semibold text-text-primary mb-4">Transaction History</h3>
        <p className="text-sm text-text-secondary">No transactions yet.</p>
      </RetailCard>
    );
  }

  return (
    <RetailCard>
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-text-primary">Transaction History</h3>
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

export default function RetailBillingPage() {
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState<BillingCurrency>('EUR');
  const [currencyStorageKey, setCurrencyStorageKey] = useState<string | null>(null);
  const hasStoredSelection = useRef(false);

  const { data: balanceData, isLoading: balanceLoading, error: balanceError } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data;
    },
    staleTime: 60 * 1000, // 1 minute
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
      const fallback = normalizeCurrency(balanceData?.billingCurrency);
      if (fallback) {
        setSelectedCurrency(fallback);
      }
    }
  }, [currencyStorageKey, balanceData?.billingCurrency]);

  const { data: packages, isLoading: packagesLoading, error: packagesError } = useQuery({
    queryKey: ['retail-packages', selectedCurrency],
    queryFn: async () => {
      const res = await billingApi.getPackages(selectedCurrency);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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

  const handleCurrencyChange = (value: string) => {
    const normalized = normalizeCurrency(value) || 'EUR';
    setSelectedCurrency(normalized);
    if (currencyStorageKey) {
      localStorage.setItem(currencyStorageKey, normalized);
    }
    hasStoredSelection.current = true;
  };

  const currencySelector = (
    <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Currency" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="EUR">EUR (€)</SelectItem>
        <SelectItem value="USD">USD ($)</SelectItem>
      </SelectContent>
    </Select>
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

  const subscription = balanceData?.subscription || { active: false, planType: null };
  const credits = balanceData?.credits || 0;
  const availablePackages = Array.isArray(packages)
    ? packages.filter((pkg) => ['credit_topup', 'subscription_package', 'credit_pack'].includes(pkg.type || ''))
    : [];

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Billing"
          description="Manage your subscription and credits"
          actions={currencySelector}
        />

        <BillingHeader subscription={subscription} credits={credits} />

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SubscriptionCard subscription={subscription} currency={selectedCurrency} />
          <CreditTopupCard currency={selectedCurrency} />
        </div>

        {subscription.active && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-text-primary">Credit Packages</h2>
              <p className="mt-1 text-sm text-text-secondary">Purchase additional credit packages</p>
            </div>
            {packagesLoading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <RetailCard key={i}>
                    <div className="h-20 animate-pulse rounded bg-surface-light"></div>
                  </RetailCard>
                ))}
              </div>
            )}
            {packagesError && (
              <RetailCard>
                <div className="text-sm text-red-400">Error loading packages</div>
              </RetailCard>
            )}
            {!packagesLoading && !packagesError && packages && (
              <>
                {availablePackages.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {availablePackages.map((pkg) => (
                      <PackageCard key={pkg.id} pkg={pkg} currency={selectedCurrency} />
                    ))}
                  </div>
                ) : (
                  <RetailCard>
                    <p className="text-sm text-text-secondary">No packages available at this time.</p>
                  </RetailCard>
                )}
              </>
            )}
          </div>
        )}

        <div className="mb-6">
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
        </div>
      </div>
    </RetailPageLayout>
  );
}
