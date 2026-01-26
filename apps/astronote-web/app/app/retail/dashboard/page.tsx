'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import Link from 'next/link';
import { dashboardApi } from '@/src/lib/retail/api/dashboard';
import { billingApi } from '@/src/lib/retail/api/billing';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { Megaphone, MessageSquare, Send, XCircle, TrendingUp, Target, CreditCard, CheckCircle, XCircle as XCircleIcon, Plus, ShoppingCart } from 'lucide-react';

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: number | string
  subtitle?: string
  icon?: any
  trend?: number
}) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <RetailCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary">{title}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-semibold text-text-primary">{displayValue}</p>
            {trend !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  trend >= 0
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 text-text-tertiary" />}
      </div>
    </RetailCard>
  );
}

function CreditsCard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data;
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  if (isLoading) {
    return (
      <RetailCard className="p-5">
        <div className="mb-4 h-4 w-28 animate-pulse rounded bg-surface-light" />
        <div className="mb-2 h-8 w-24 animate-pulse rounded bg-surface-light" />
        <div className="h-4 w-40 animate-pulse rounded bg-surface-light" />
      </RetailCard>
    );
  }

  if (error) {
    return (
      <RetailCard>
        <h3 className="mb-4 text-lg font-semibold text-text-primary">Credits & Subscription</h3>
        <div className="text-sm text-red-400">Error loading balance</div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
          Retry
        </Button>
      </RetailCard>
    );
  }

  const balance = (data as any)?.totalCredits ?? (data?.credits || 0);
  const subscription = data?.subscription || { active: false, planType: null };

  return (
    <RetailCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-accent" />
          <h3 className="text-base font-semibold text-text-primary">Credits & Subscription</h3>
        </div>
        <Link href="/app/retail/billing" className="text-xs font-semibold text-accent">
          Manage billing
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr,1fr]">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Available credits</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{balance.toLocaleString()}</p>
          <p className="mt-1 text-xs text-text-tertiary">Credits never expire.</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Subscription status</p>
          <div className="mt-2 flex items-center gap-2">
            {subscription.active ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Active
                </span>
                {subscription.planType && (
                  <span className="text-xs capitalize text-text-secondary">
                    {subscription.planType}
                  </span>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                <XCircleIcon className="h-4 w-4" />
                Inactive
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Spending requires an active subscription.
          </p>
        </div>
      </div>
    </RetailCard>
  );
}

export default function RetailDashboardPage() {
  // Check if token exists before making query
  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('accessToken') : false;

  // Log token status on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      // eslint-disable-next-line no-console
      console.log('[Dashboard] Token status:', token ? 'present' : 'absent');
      // eslint-disable-next-line no-console
      console.log('[Dashboard] Will fetch KPIs:', hasToken);
    }
  }, [hasToken]);

  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKPIs } = useQuery({
    queryKey: ['retail-kpis'],
    queryFn: async () => {
      // Log request attempt (development only)
      if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[Dashboard] Fetching KPIs...');
      }
      const res = await dashboardApi.getKPIs();
      if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[Dashboard] KPIs response:', res.data);
      }
      return res.data;
    },
    enabled: hasToken, // Only run query if token exists
    staleTime: 10 * 1000, // 10 seconds
    retry: 1, // Retry once on failure
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  // Show error state but don't block the page - allow navigation
  if (kpisError) {
    // Log error details (development only)
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[Dashboard] KPI fetch error:', kpisError);
      if ((kpisError as any)?.response) {
        // eslint-disable-next-line no-console
        console.error('[Dashboard] Error response:', {
          status: (kpisError as any).response.status,
          data: (kpisError as any).response.data,
        });
      }
    }

    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Dashboard"
            description="Overview of your SMS campaigns and performance"
            actions={
              <>
                <Link href="/app/retail/campaigns/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                </Link>
                <Link href="/app/retail/billing">
                  <Button variant="outline" size="sm">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Credits
                  </Button>
                </Link>
              </>
            }
          />

          <RetailCard variant="danger" className="p-5">
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 h-6 w-6 shrink-0 text-red-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-base font-semibold text-text-primary">Error Loading Dashboard Data</h3>
                <p className="mb-4 text-sm text-text-secondary">
                  {kpisError instanceof Error
                    ? kpisError.message
                    : (kpisError as any)?.response?.data?.message || 'Failed to load dashboard KPIs'}
                </p>
                <Button onClick={() => refetchKPIs()} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          </RetailCard>

          <CreditsCard />
        </div>
      </RetailPageLayout>
    );
  }

  // Show loading state but don't block navigation
  if (kpisLoading || !hasToken) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Dashboard"
            description="Overview of your SMS campaigns and performance"
            actions={
              <>
                <Link href="/app/retail/campaigns/new">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Button>
                </Link>
                <Link href="/app/retail/billing">
                  <Button variant="outline" size="sm">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Buy Credits
                  </Button>
                </Link>
              </>
            }
          />

          {/* Loading Skeletons */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <RetailCard key={i} className="p-5">
                <div className="mb-4 h-4 w-28 animate-pulse rounded bg-surface-light"></div>
                <div className="h-8 w-24 animate-pulse rounded bg-surface-light"></div>
              </RetailCard>
            ))}
          </div>
          {/* Show CreditsCard even while loading */}
          <CreditsCard />
        </div>
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Dashboard"
          description="Overview of your SMS campaigns and performance"
          actions={
            <>
              <Link href="/app/retail/campaigns/new">
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </Link>
              <Link href="/app/retail/billing">
                <Button variant="outline" size="sm">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Buy Credits
                </Button>
              </Link>
            </>
          }
        />

        {/* KPI Cards - Responsive Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Campaigns"
            value={kpis?.totalCampaigns || 0}
            subtitle="All time"
            icon={Megaphone}
          />
          <KpiCard
            title="Total Messages"
            value={kpis?.totalMessages || 0}
            subtitle="All time"
            icon={MessageSquare}
          />
          <KpiCard
            title="Messages Sent"
            value={kpis?.sent || 0}
            subtitle={`${kpis?.sentRate ? (kpis.sentRate * 100).toFixed(1) : 0}% success rate`}
            icon={Send}
          />
          <KpiCard
            title="Messages Failed"
            value={kpis?.failed || 0}
            subtitle="Failed deliveries"
            icon={XCircle}
          />
          <KpiCard
            title="Conversions"
            value={kpis?.conversion || 0}
            subtitle="Offer redemptions"
            icon={Target}
          />
          <KpiCard
            title="Conversion Rate"
            value={kpis?.conversionRate ? (kpis.conversionRate * 100).toFixed(1) : 0}
            subtitle="% of sent messages"
            icon={TrendingUp}
            trend={kpis?.conversionRate ? kpis.conversionRate * 100 : 0}
          />
        </div>

        {/* Credits & Subscription */}
        <CreditsCard />
      </div>
    </RetailPageLayout>
  );
}
