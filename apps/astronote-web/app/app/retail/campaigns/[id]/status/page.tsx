'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCampaignStatus } from '@/src/features/retail/campaigns/hooks/useCampaignStatus';
import { CampaignProgressCard } from '@/src/features/retail/campaigns/components/CampaignProgressCard';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CampaignStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const { data, isLoading, error, refetch } = useCampaignStatus(id);

  if (isLoading && !data) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Campaign Status" description="Real-time progress" />
          <RetailCard>
            <div className="h-32 animate-pulse rounded bg-surface-light"></div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  if (error) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Campaign Status" description="Error loading status" />
          <RetailCard variant="danger">
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">Error loading campaign status</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  if (!data) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Campaign Status" description="Status not found" />
          <RetailCard>
            <div className="py-8 text-center">
              <p className="text-text-secondary">Status not found</p>
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
          title="Campaign Status"
          description={`Real-time progress for ${data.campaign?.name || 'campaign'}`}
        />
        <CampaignProgressCard campaign={data.campaign} metrics={data.metrics} />
      </div>
    </RetailPageLayout>
  );
}

