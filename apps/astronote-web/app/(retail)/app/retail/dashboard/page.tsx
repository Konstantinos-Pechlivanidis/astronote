'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { dashboardApi } from '@/src/lib/retail/api/dashboard';
import { billingApi } from '@/src/lib/retail/api/billing';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Megaphone, MessageSquare, Send, XCircle, TrendingUp, Target, CreditCard, CheckCircle, XCircle as XCircleIcon } from 'lucide-react';

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
  return (
    <GlassCard hover>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {Icon && <Icon className="w-5 h-5 text-text-tertiary" />}
      </div>
      <div className="flex items-baseline">
        <p className="text-3xl font-bold text-text-primary">{value}</p>
        {trend !== undefined && (
          <span
            className={`ml-2 text-sm font-medium ${
              trend > 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend > 0 ? '+' : ''}
            {trend}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
    </GlassCard>
  );
}

function CreditsCard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <GlassCard>
        <div className="h-6 bg-surface-light rounded w-32 mb-4 animate-pulse" />
        <div className="h-8 bg-surface-light rounded w-24 mb-2 animate-pulse" />
        <div className="h-4 bg-surface-light rounded w-40 animate-pulse" />
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <h3 className="text-lg font-semibold text-text-primary mb-4">Credits & Subscription</h3>
        <div className="text-sm text-red-400">Error loading balance</div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-accent hover:underline"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  const balance = data?.credits || 0;
  const subscription = data?.subscription || { active: false, planType: null };

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-text-primary">Credits & Subscription</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-text-secondary mb-1">Available Credits</p>
          <p className="text-3xl font-bold text-text-primary">{balance.toLocaleString()}</p>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary mb-1">Subscription Status</p>
              <div className="flex items-center gap-2">
                {subscription.active ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-sm font-medium text-green-400">Active</span>
                    {subscription.planType && (
                      <span className="text-sm text-text-secondary capitalize">
                        ({subscription.planType})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
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
    staleTime: 30 * 1000, // 30 seconds
    retry: 1, // Retry once on failure
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
      <div className="space-y-6">
        {/* Error card - doesn't block navigation */}
        <GlassCard>
          <div className="flex items-start gap-4">
            <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Error Loading Dashboard Data</h3>
              <p className="text-sm text-text-secondary mb-4">
                {kpisError instanceof Error
                  ? kpisError.message
                  : (kpisError as any)?.response?.data?.message || 'Failed to load dashboard KPIs'}
              </p>
              <Button onClick={() => refetchKPIs()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Show CreditsCard even on error - don't block entire page */}
        <CreditsCard />
      </div>
    );
  }

  // Show loading state but don't block navigation
  if (kpisLoading || !hasToken) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <GlassCard key={i}>
              <div className="h-6 bg-surface-light rounded w-32 mb-4 animate-pulse"></div>
              <div className="h-8 bg-surface-light rounded w-24 animate-pulse"></div>
            </GlassCard>
          ))}
        </div>
        {/* Show CreditsCard even while loading */}
        <CreditsCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  );
}
