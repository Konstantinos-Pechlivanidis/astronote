'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/src/lib/retail/api/dashboard';
import { billingApi } from '@/src/lib/retail/api/billing';
import { GlassCard } from '@/components/ui/glass-card';
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
        <div className="h-6 bg-surface-light rounded w-32 mb-4 animate-pulse"></div>
        <div className="h-8 bg-surface-light rounded w-24 mb-2 animate-pulse"></div>
        <div className="h-4 bg-surface-light rounded w-40 animate-pulse"></div>
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
  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKPIs } = useQuery({
    queryKey: ['retail-kpis'],
    queryFn: async () => {
      const res = await dashboardApi.getKPIs();
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  if (kpisLoading) {
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
      </div>
    );
  }

  if (kpisError) {
    return (
      <div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading dashboard data</p>
            <button
              onClick={() => refetchKPIs()}
              className="text-sm text-accent hover:underline"
            >
              Retry
            </button>
          </div>
        </GlassCard>
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

