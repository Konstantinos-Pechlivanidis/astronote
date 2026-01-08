'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCampaignStats } from '@/src/features/retail/campaigns/hooks/useCampaignStats';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Target, TrendingUp, Users, XCircle } from 'lucide-react';

function CampaignStatsCards({ stats }: { stats: any }) {
  if (!stats) return null;

  const delivered = stats.metrics?.delivered ?? stats.sent ?? 0;
  const total = stats.metrics?.total ?? stats.total ?? 0;
  const conversionRate = delivered > 0 ? (stats.conversions / delivered) * 100 : 0;
  const unsubscribeRate = delivered > 0 ? (stats.unsubscribes / delivered) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <RetailCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Total Messages</h3>
          <Users className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">{total?.toLocaleString() || 0}</p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">All recipients</p>
      </RetailCard>

      <RetailCard hover>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-secondary">Delivered</h3>
          <TrendingUp className="w-5 h-5 text-text-tertiary" />
        </div>
        <div className="flex items-baseline">
          <p className="text-3xl font-bold text-text-primary">{delivered?.toLocaleString() || 0}</p>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          {total > 0 ? ((delivered / total) * 100).toFixed(1) : 0}% delivery rate
        </p>
      </RetailCard>

      <RetailCard hover>
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
      </RetailCard>

      <RetailCard hover>
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
      </RetailCard>
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
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Campaign Statistics"
            description="Performance metrics and analytics"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <RetailCard key={i}>
                <div className="h-20 animate-pulse rounded bg-surface-light"></div>
              </RetailCard>
            ))}
          </div>
        </div>
      </RetailPageLayout>
    );
  }

  if (error) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Campaign Statistics" description="Error loading stats" />
          <RetailCard variant="danger">
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">Error loading campaign statistics</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push(`/app/retail/campaigns/${id}`)}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaign
          </Button>
        </div>
        <RetailPageHeader
          title="Campaign Statistics"
          description="Performance metrics and analytics"
        />
        <CampaignStatsCards stats={stats} />
      </div>
    </RetailPageLayout>
  );
}
