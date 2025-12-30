'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCampaignStats } from '@/src/features/retail/campaigns/hooks/useCampaignStats';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, TrendingUp, Users, XCircle } from 'lucide-react';

function CampaignStatsCards({ stats }: { stats: any }) {
  if (!stats) return null;

  const conversionRate = stats.sent > 0 ? (stats.conversions / stats.sent) * 100 : 0;
  const unsubscribeRate = stats.sent > 0 ? (stats.unsubscribes / stats.sent) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <GlassCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Total Messages</h3>
          <Users className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">{stats.total?.toLocaleString() || 0}</p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">All recipients</p>
      </GlassCard>

      <GlassCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Sent</h3>
          <TrendingUp className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">{stats.sent?.toLocaleString() || 0}</p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          {stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : 0}% success rate
        </p>
      </GlassCard>

      <GlassCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Conversions</h3>
          <Target className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">
            {stats.conversions?.toLocaleString() || 0}
          </p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">{conversionRate.toFixed(1)}% conversion rate</p>
      </GlassCard>

      <GlassCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Unsubscribes</h3>
          <XCircle className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">
            {stats.unsubscribes?.toLocaleString() || 0}
          </p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">{unsubscribeRate.toFixed(1)}% unsubscribe rate</p>
      </GlassCard>
    </div>
  );
}

export default function CampaignStatsPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { data: stats, isLoading, error, refetch } = useCampaignStats(id);

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <div className="h-6 bg-surface-light rounded w-32 animate-pulse"></div>
        </div>
        <div className="mb-6">
          <div className="h-8 bg-surface-light rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-surface-light rounded w-64 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <GlassCard key={i}>
              <div className="h-20 bg-surface-light rounded animate-pulse"></div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Campaign Statistics</h1>
          <p className="text-sm text-text-secondary mt-1">Error loading stats</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading campaign statistics</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Button
          onClick={() => router.push(`/app/retail/campaigns/${id}`)}
          variant="ghost"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaign
        </Button>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Campaign Statistics</h1>
        <p className="text-sm text-text-secondary mt-1">Performance metrics and analytics</p>
      </div>

      <div className="mt-6">
        <CampaignStatsCards stats={stats} />
      </div>
    </div>
  );
}

