'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaign';
import { useCampaignMetrics } from '@/src/features/shopify/campaigns/hooks/useCampaignMetrics';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BarChart3, TrendingUp, Users, MessageSquare, XCircle, CheckCircle } from 'lucide-react';

/**
 * Campaign Stats Page
 * Detailed metrics and analytics for a campaign
 */
export default function CampaignStatsPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: campaign, isLoading: campaignLoading } = useCampaign(id);
  const { data: metrics, isLoading: metricsLoading } = useCampaignMetrics(id);

  if (campaignLoading || metricsLoading) {
    return (
      <div>
        <RetailPageHeader title="Campaign Stats" />
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

  if (!campaign || !metrics) {
    return (
      <div>
        <RetailPageHeader title="Campaign Stats" />
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
            title={`Stats: ${campaign.name}`}
            description="Detailed campaign metrics and analytics"
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <RetailCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-secondary">Total Recipients</h3>
            <Users className="h-5 w-5 text-text-tertiary" />
          </div>
          <div className="text-3xl font-bold text-text-primary">{metrics.total || 0}</div>
        </RetailCard>

        <RetailCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-secondary">Messages Sent</h3>
            <MessageSquare className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-400">{metrics.sent || 0}</div>
          {metrics.total > 0 && (
            <div className="mt-2 text-xs text-text-tertiary">
              {((metrics.sent / metrics.total) * 100).toFixed(1)}% of total
            </div>
          )}
        </RetailCard>

        <RetailCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text-secondary">Failed</h3>
            <XCircle className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-red-400">{metrics.failed || 0}</div>
          {metrics.total > 0 && (
            <div className="mt-2 text-xs text-text-tertiary">
              {((metrics.failed / metrics.total) * 100).toFixed(1)}% of total
            </div>
          )}
        </RetailCard>

        {metrics.delivered !== undefined && (
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Delivered</h3>
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">{metrics.delivered || 0}</div>
            {metrics.sent > 0 && (
              <div className="mt-2 text-xs text-text-tertiary">
                {((metrics.delivered / metrics.sent) * 100).toFixed(1)}% delivery rate
              </div>
            )}
          </RetailCard>
        )}

        {metrics.conversions !== undefined && (
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Conversions</h3>
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div className="text-3xl font-bold text-accent">{metrics.conversions || 0}</div>
            {metrics.sent > 0 && (
              <div className="mt-2 text-xs text-text-tertiary">
                {((metrics.conversions / metrics.sent) * 100).toFixed(2)}% conversion rate
              </div>
            )}
          </RetailCard>
        )}

        {metrics.conversionRate !== undefined && (
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Conversion Rate</h3>
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div className="text-3xl font-bold text-accent">
              {(metrics.conversionRate * 100).toFixed(2)}%
            </div>
            <div className="mt-2 text-xs text-text-tertiary">of sent messages</div>
          </RetailCard>
        )}

        {metrics.unsubscribes !== undefined && (
          <RetailCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-secondary">Unsubscribes</h3>
              <Users className="h-5 w-5 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-orange-400">{metrics.unsubscribes || 0}</div>
            {metrics.sent > 0 && (
              <div className="mt-2 text-xs text-text-tertiary">
                {((metrics.unsubscribes / metrics.sent) * 100).toFixed(2)}% unsubscribe rate
              </div>
            )}
          </RetailCard>
        )}
      </div>

      {/* Summary Card */}
      <RetailCard className="mt-6 p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Summary</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Campaign Name</div>
            <div className="text-text-primary">{campaign.name}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Total Messages</div>
            <div className="text-text-primary">{metrics.total || 0}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-text-secondary mb-1">Success Rate</div>
            <div className="text-text-primary">
              {metrics.total > 0
                ? (((metrics.sent - (metrics.failed || 0)) / metrics.total) * 100).toFixed(1)
                : 0}
              %
            </div>
          </div>
        </div>
      </RetailCard>
    </div>
  );
}

