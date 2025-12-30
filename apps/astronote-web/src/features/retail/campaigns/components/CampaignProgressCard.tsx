'use client';

import { format } from 'date-fns';
import { GlassCard } from '@/components/ui/glass-card';

interface CampaignProgressCardProps {
  campaign: {
    total?: number
    status?: string
    scheduledAt?: string
    startedAt?: string
    finishedAt?: string
  }
  metrics?: {
    queued: number
    success: number
    processed: number
    failed: number
  }
}

export function CampaignProgressCard({ campaign, metrics }: CampaignProgressCardProps) {
  if (!metrics) return null;

  const { queued, success, processed, failed } = metrics;
  const total = campaign.total || 0;
  const processedProgress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <GlassCard>
      <h3 className="text-lg font-semibold text-text-primary mb-4">Campaign Progress</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-text-secondary mb-1">
            <span>Total Recipients</span>
            <span className="font-medium text-text-primary">{total.toLocaleString()}</span>
          </div>
          <div className="w-full bg-surface-light rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, processedProgress)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-text-secondary">Queued</div>
            <div className="text-2xl font-bold text-text-primary">{queued.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Sent</div>
            <div className="text-2xl font-bold text-green-500">{success.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Failed</div>
            <div className="text-2xl font-bold text-red-500">{failed.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Processed</div>
            <div className="text-2xl font-bold text-accent">{processed.toLocaleString()}</div>
          </div>
        </div>

        {campaign.scheduledAt && campaign.status === 'scheduled' && (
          <div className="pt-4 border-t border-border">
            <div className="text-sm text-text-secondary">Scheduled for</div>
            <div className="text-lg font-medium text-text-primary">
              {format(new Date(campaign.scheduledAt), 'PPpp')}
            </div>
          </div>
        )}

        {campaign.startedAt && (
          <div className="pt-4 border-t border-border">
            <div className="text-sm text-text-secondary">Started at</div>
            <div className="text-lg font-medium text-text-primary">
              {format(new Date(campaign.startedAt), 'PPpp')}
            </div>
          </div>
        )}

        {campaign.finishedAt && (
          <div className="pt-4 border-t border-border">
            <div className="text-sm text-text-secondary">Finished at</div>
            <div className="text-lg font-medium text-text-primary">
              {format(new Date(campaign.finishedAt), 'PPpp')}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

