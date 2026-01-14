'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaign';
import {
  useCampaignStatus,
  useCampaignProgress,
} from '@/src/features/shopify/campaigns/hooks/useCampaignMetrics';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, CheckCircle, XCircle, Hourglass } from 'lucide-react';

/**
 * Campaign Status Page
 * Real-time status with Phase 2.2 metrics (queued, processed, sent, failed)
 */
export default function CampaignStatusPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: campaign, isLoading: campaignLoading } = useCampaign(id);

  // Auto-refresh status if campaign is active
  const isActive = campaign?.status === 'sending' || campaign?.status === 'scheduled';
  const { data: statusData, isLoading: statusLoading } = useCampaignStatus(id, {
    enabled: isActive,
    refetchInterval: isActive ? 30 * 1000 : false, // Auto-refresh every 30s
  });

  const { data: progressData, isLoading: progressLoading } = useCampaignProgress(id);

  if (campaignLoading || statusLoading || progressLoading) {
    return (
      <div>
        <RetailPageHeader title="Campaign Status" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <RetailCard key={i} className="p-6">
              <div className="h-6 w-32 animate-pulse rounded bg-surface-light mb-2" />
              <div className="h-8 w-24 animate-pulse rounded bg-surface-light" />
            </RetailCard>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <RetailPageHeader title="Campaign Status" />
        <RetailCard className="p-6">
          <div className="text-center py-8">
            <p className="text-text-secondary">Campaign not found</p>
            <Link href="/app/shopify/campaigns">
              <Button variant="outline" className="mt-4">Back to Campaigns</Button>
            </Link>
          </div>
        </RetailCard>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/app/shopify/campaigns/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title={`Status: ${campaign.name}`}
            description={
              isActive
                ? 'Real-time campaign status (updates every 30 seconds)'
                : 'Campaign status information'
            }
          />
        </div>
      </div>

      {/* Status Cards (canonical: provider accepted/delivered/failed/pending delivery) */}
      {statusData?.canonical ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Queued</h3>
              <Hourglass className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-400">{statusData.canonical.queued || 0}</div>
            <div className="mt-2 text-xs text-text-tertiary">Not yet accepted by provider</div>
          </RetailCard>

          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Accepted</h3>
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400">
              {statusData.canonical.totals?.accepted ?? 0}
            </div>
            <div className="mt-2 text-xs text-text-tertiary">Provider accepted (Mitto messageId created)</div>
          </RetailCard>

          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Delivered</h3>
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">
              {statusData.canonical.delivery?.delivered ?? 0}
            </div>
            <div className="mt-2 text-xs text-text-tertiary">Confirmed by provider DLR/polling</div>
          </RetailCard>

          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Failed</h3>
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-red-400">
              {statusData.canonical.delivery?.failedDelivery ?? 0}
            </div>
            <div className="mt-2 text-xs text-text-tertiary">Provider delivery failed / terminal failure</div>
          </RetailCard>
        </div>
      ) : statusData ? (
        // Fallback: legacy fields if canonical not present (older servers)
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Queued</h3>
              <Hourglass className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-400">{(statusData as any).queued || (statusData as any).metrics?.queued || 0}</div>
            <div className="mt-2 text-xs text-text-tertiary">Waiting</div>
          </RetailCard>
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Sent</h3>
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">{(statusData as any).sent || (statusData as any).metrics?.success || 0}</div>
            <div className="mt-2 text-xs text-text-tertiary">Legacy</div>
          </RetailCard>
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Failed</h3>
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-red-400">{(statusData as any).failed || (statusData as any).metrics?.failed || 0}</div>
            <div className="mt-2 text-xs text-text-tertiary">Legacy</div>
          </RetailCard>
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Processed</h3>
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-blue-400">{(statusData as any).processed || (statusData as any).metrics?.processed || 0}</div>
            <div className="mt-2 text-xs text-text-tertiary">Legacy</div>
          </RetailCard>
        </div>
      ) : (
        <RetailCard className="p-6">
          <div className="text-center py-8">
            <p className="text-text-secondary">
              Status data not available for this campaign
            </p>
          </div>
        </RetailCard>
      )}

      {/* Progress Card */}
      {progressData && (
        <RetailCard className="mt-6 p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Progress
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-secondary">Overall Progress</span>
                <span className="text-sm font-medium text-text-primary">
                  {progressData.percentage ?? progressData.progress ?? 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${progressData.percentage ?? progressData.progress ?? 0}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Accepted</div>
                <div className="text-2xl font-bold text-blue-400">{progressData.accepted ?? progressData.sent ?? 0}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-400">{progressData.failedDelivery ?? progressData.failed ?? 0}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Pending delivery</div>
                <div className="text-2xl font-bold text-yellow-400">{progressData.pendingDelivery ?? 0}</div>
              </div>
            </div>
          </div>
        </RetailCard>
      )}

      {/* Campaign Info */}
      <RetailCard className="mt-6 p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Campaign Information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Campaign Name</div>
            <div className="text-text-primary">{campaign.name}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Status</div>
            <div className="text-text-primary capitalize">{campaign.status}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Total Recipients</div>
            <div className="text-text-primary">{campaign.recipientCount || 0}</div>
          </div>
        </div>
      </RetailCard>
    </div>
  );
}

