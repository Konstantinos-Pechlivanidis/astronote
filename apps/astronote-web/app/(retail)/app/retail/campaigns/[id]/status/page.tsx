'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCampaignStatus } from '@/src/features/retail/campaigns/hooks/useCampaignStatus';
import { CampaignProgressCard } from '@/src/features/retail/campaigns/components/CampaignProgressCard';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CampaignStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { data, isLoading, error, refetch } = useCampaignStatus(id);

  if (isLoading && !data) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-8 bg-surface-light rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-surface-light rounded w-64 animate-pulse"></div>
        </div>
        <GlassCard>
          <div className="h-32 bg-surface-light rounded animate-pulse"></div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Campaign Status</h1>
          <p className="text-sm text-text-secondary mt-1">Error loading status</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error loading campaign status</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Campaign Status</h1>
          <p className="text-sm text-text-secondary mt-1">Status not found</p>
        </div>
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-text-secondary">Status not found</p>
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
        <h1 className="text-2xl font-bold text-text-primary">Campaign Status</h1>
        <p className="text-sm text-text-secondary mt-1">
          Real-time progress for {data.campaign?.name || 'campaign'}
        </p>
      </div>

      <div className="mt-6">
        <CampaignProgressCard campaign={data.campaign} metrics={data.metrics} />
      </div>
    </div>
  );
}

