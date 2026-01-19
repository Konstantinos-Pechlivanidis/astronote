'use client';

import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useCampaign } from '@/src/features/retail/campaigns/hooks/useCampaign';
import { useCampaignPreview } from '@/src/features/retail/campaigns/hooks/useCampaignPreview';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Send, Eye, BarChart3, XCircle } from 'lucide-react';
import { useEnqueueCampaign } from '@/src/features/retail/campaigns/hooks/useEnqueueCampaign';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import Link from 'next/link';
import { useRef } from 'react';

function MessagePreviewModal({
  open,
  onClose,
  messages,
  isLoading,
}: {
  open: boolean
  onClose: () => void
  messages?: Array<{ to: string; text: string }>
  isLoading: boolean
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <RetailCard className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Message Preview</h2>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Close preview modal"
            >
              <XCircle className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
              <p className="text-sm text-text-secondary">Loading preview...</p>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Showing first {messages.length} rendered messages:
              </p>
              {messages.map((msg, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 bg-surface-light">
                  <div className="text-xs text-text-tertiary mb-1">To: {msg.to}</div>
                  <div className="text-sm text-text-primary whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary">No messages to preview</p>
            </div>
          )}
        </RetailCard>
      </div>
    </div>
  );
}

function CampaignActions({
  campaign,
  onPreviewMessages,
  onViewStats,
}: {
  campaign: any
  onPreviewMessages: () => void
  onViewStats: () => void
}) {
  const billingGate = useBillingGate();
  const enqueueMutation = useEnqueueCampaign();
  const [enqueueConfirm, setEnqueueConfirm] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [enqueueResult, setEnqueueResult] = useState<{ queued?: number; enqueuedJobs?: number } | null>(null);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const enqueueOpenRef = useRef(enqueueConfirm);

  useEffect(() => {
    enqueueOpenRef.current = enqueueConfirm;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] confirmation dialog open change', { open: enqueueConfirm });
    }
  }, [enqueueConfirm]);

  // Dev-only instrumentation to detect click blockers and overlay targets
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;
    if ((window as any).__ASTRONOTE_DEBUG_DIALOG_LISTENER__) return;
    (window as any).__ASTRONOTE_DEBUG_DIALOG_LISTENER__ = true;

    const handler = (e: MouseEvent) => {
      const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      const path = (e.composedPath ? e.composedPath() : []).slice(0, 8);
      // eslint-disable-next-line no-console
      console.log('[DIALOG DEBUG] click target=', e.target);
      // eslint-disable-next-line no-console
      console.log('[DIALOG DEBUG] path=', path);
      // eslint-disable-next-line no-console
      console.log('[DIALOG DEBUG] elementFromPoint(center)=', centerEl);
    };

    window.addEventListener('click', handler, true);
    return () => window.removeEventListener('click', handler, true);
  }, []);

  const status = campaign.status;
  const isDraft = status === 'draft';
  const isScheduled = status === 'scheduled';
  const isSending = status === 'sending';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const canEnqueueStatus = isDraft || isScheduled;
  const canEnqueue =
    canEnqueueStatus &&
    !enqueueMutation.isPending &&
    !isEnqueuing;
  const canEdit = ['draft', 'scheduled'].includes(status);
  const subscriptionInactive = !billingGate.canSendCampaigns;
  const showEnqueueAction = !isFailed && !isCompleted;
  const enqueueLabel = isSending ? 'Sending...' : isScheduled ? 'Enqueue now' : 'Send Campaign';
  const failedGuidance = 'Campaign failed. Create a new campaign or contact support.';
  const retrySupported = false;

  const describeEnqueueError = (error: any) => {
    const code = error?.response?.data?.code || error?.code;
    const rawMessage = error?.response?.data?.message || error?.message || 'Failed to enqueue campaign';
    const statusMatch = rawMessage.match(/invalid_status:([a-z_]+)/i);
    const currentStatus = error?.response?.data?.currentStatus || error?.currentStatus || statusMatch?.[1] || null;

    if (code === 'INVALID_STATUS' || code === 'ENQUEUE_CONFLICT_STATUS') {
      if (currentStatus === 'failed') {
        return failedGuidance;
      }
      if (currentStatus === 'sending') {
        return 'Campaign is already sending. Check status for progress.';
      }
      if (currentStatus === 'completed') {
        return 'Campaign already completed. Create a new campaign to send again.';
      }
      if (currentStatus === 'scheduled') {
        return 'Campaign is scheduled. Use "Enqueue now" to send immediately or edit the schedule.';
      }
      return currentStatus
        ? `Campaign cannot be sent in its current state (${currentStatus}).`
        : 'Campaign cannot be sent in its current state.';
    }
    if (code === 'PRISMA_SCHEMA_DRIFT') {
      return 'Service temporarily unavailable while we sync billing data. Please retry shortly.';
    }
    if (code === 'QUEUE_UNAVAILABLE') {
      return 'Messaging queue unavailable. Please try again soon.';
    }

    return rawMessage;
  };

  const handleEnqueue = () => {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] handleEnqueue called', { subscriptionInactive, campaignId: campaign.id });
    }
    if (subscriptionInactive) {
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] Blocked: subscription inactive');
      }
      return;
    }
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] Opening confirmation dialog');
    }
    setEnqueueError(null);
    setEnqueueResult(null);
    setEnqueueConfirm((prev) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] setEnqueueConfirm updater', { prev, next: true });
      }
      return true;
    });
    setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] after setEnqueueConfirm timeout', { current: enqueueOpenRef.current });
      }
    }, 0);
  };

  const handleConfirmEnqueue = async () => {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] handleConfirmEnqueue called', { isEnqueuing, isPending: enqueueMutation.isPending, campaignId: campaign.id });
    }
    if (isEnqueuing || enqueueMutation.isPending) {
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] Blocked: already enqueuing or pending');
      }
      return;
    }

    setIsEnqueuing(true);
    setEnqueueError(null);
    setEnqueueResult(null);
    setEnqueueConfirm(false);

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] Calling mutation', { id: campaign.id, status: campaign.status });
      // eslint-disable-next-line no-console
      console.log('[SEND CLICK] Enqueue start');
    }

    try {
      const data = await enqueueMutation.mutateAsync({ id: campaign.id, status: campaign.status });
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] Mutation success', data);
      }
      setEnqueueResult(data || null);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('[SEND CLICK] Mutation error', error);
      }
      setEnqueueError(describeEnqueueError(error));
    } finally {
      setIsEnqueuing(false);
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[SEND CLICK] Enqueue finished');
      }
    }
  };

  const enqueueTitle = subscriptionInactive
    ? 'Active subscription required to send campaigns. Please subscribe in Billing.'
    : !canEnqueueStatus
      ? isSending
        ? 'Campaign is already sending'
        : isCompleted
          ? 'Campaign already completed'
          : isFailed
            ? failedGuidance
            : 'Campaign cannot be sent in its current state'
      : isEnqueuing || enqueueMutation.isPending
        ? 'Sending campaign...'
        : isScheduled
          ? 'Send immediately and bypass the schedule'
          : 'Send this campaign';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showEnqueueAction && (
          <Button
            onClick={(e) => {
              // eslint-disable-next-line no-console
              if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.log('[SEND CLICK] Button onClick triggered', {
                  subscriptionInactive,
                  isEnqueuing,
                  isPending: enqueueMutation.isPending,
                  canEnqueue,
                  campaignId: campaign.id,
                  campaignStatus: campaign.status,
                });
              }
              e.preventDefault();
              e.stopPropagation();
              handleEnqueue();
            }}
            disabled={subscriptionInactive || isEnqueuing || enqueueMutation.isPending || !canEnqueueStatus}
            title={enqueueTitle}
            aria-label={isScheduled ? 'Enqueue campaign now' : 'Send campaign'}
            type="button"
          >
            <Send className="w-4 h-4 mr-2" aria-hidden="true" />
            {isEnqueuing || enqueueMutation.isPending ? 'Sending...' : enqueueLabel}
          </Button>
        )}

        <Button onClick={onPreviewMessages} variant="outline" aria-label="Preview messages">
          <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
          Preview Messages
        </Button>

        {(campaign.status === 'sending' || campaign.status === 'scheduled') && (
          <Link href={`/app/retail/campaigns/${campaign.id}/status`}>
            <Button variant="outline" aria-label="View campaign status">
              <BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" />
              View Status
            </Button>
          </Link>
        )}

        {['completed', 'failed'].includes(campaign.status) && (
          <Button onClick={onViewStats} variant="outline" aria-label="View campaign statistics">
            <BarChart3 className="w-4 h-4 mr-2" aria-hidden="true" />
            View Stats
          </Button>
        )}

        {canEdit && (
          <Link href={`/app/retail/campaigns/${campaign.id}/edit`}>
            <Button variant="outline" aria-label="Edit campaign">Edit</Button>
          </Link>
        )}
      </div>

      {(isEnqueuing || enqueueMutation.isPending || enqueueResult || enqueueError) && (
        <div className="mt-2 space-y-1">
          {(isEnqueuing || enqueueMutation.isPending) && (
            <p className="text-sm text-text-secondary">Enqueue request in progress...</p>
          )}
          {enqueueResult && (
            <p className="text-sm text-text-secondary">
              Last enqueue: queued {enqueueResult.queued ?? 0} message{(enqueueResult.queued ?? 0) === 1 ? '' : 's'}
              {typeof enqueueResult.enqueuedJobs === 'number'
                ? ` (${enqueueResult.enqueuedJobs} jobs enqueued)`
                : ''}
              .
            </p>
          )}
          {enqueueError && (
            <p className="text-sm text-red-400">Last error: {enqueueError}</p>
          )}
        </div>
      )}

      {subscriptionInactive && canEnqueue && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                {billingGate.reason || 'Active subscription required to send campaigns'}
              </p>
              <p className="text-xs text-red-400/80 mt-1">
                <Link href={billingGate.ctaTarget || '/app/retail/billing'} className="underline">
                  Go to Billing
                </Link>{' '}
                to subscribe and start sending campaigns.
              </p>
            </div>
          </div>
        </div>
      )}

      {isScheduled && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">
                This campaign is scheduled. You can enqueue now to send immediately or edit the schedule.
              </p>
              <p className="text-xs text-amber-400/80 mt-1">
                <Link href={`/app/retail/campaigns/${campaign.id}/edit`} className="underline">
                  Edit campaign
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {isFailed && !retrySupported && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">{failedGuidance}</p>
              {campaign.lastEnqueueError && (
                <p className="text-xs text-red-400/80 mt-1">
                  Last error: {campaign.lastEnqueueError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={enqueueConfirm}
        onClose={() => setEnqueueConfirm(false)}
        onOpenChange={setEnqueueConfirm}
        onConfirm={handleConfirmEnqueue}
        title={isScheduled ? 'Enqueue now' : 'Send Campaign'}
        message={
          isScheduled
            ? campaign.total
              ? `This will send immediately to ${campaign.total.toLocaleString()} recipients and ignore the schedule. Continue?`
              : 'This will send immediately and ignore the schedule. Continue?'
            : campaign.total
              ? `This will send the campaign to ${campaign.total.toLocaleString()} recipients. Continue?`
              : 'This will send the campaign. Continue?'
        }
        confirmText={isScheduled ? 'Enqueue now' : 'Send now'}
        cancelText="Cancel"
        confirmDisabled={isEnqueuing || enqueueMutation.isPending}
        confirmLoading={isEnqueuing || enqueueMutation.isPending}
      />
    </>
  );
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: campaign, isLoading, error, refetch } = useCampaign(id);
  const { data: previewData, isLoading: previewLoading } = useCampaignPreview(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 bg-surface-light rounded w-48 mb-2 animate-pulse"></div>
          <div className="h-4 bg-surface-light rounded w-64 animate-pulse"></div>
        </div>
        <RetailCard>
          <div className="h-32 animate-pulse rounded bg-surface-light"></div>
        </RetailCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">Error loading campaign</p>
        </div>
        <RetailCard variant="danger">
          <div className="py-8 text-center">
            <p className="mb-4 text-red-400">Error loading campaign details</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </RetailCard>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Campaign</h1>
          <p className="text-sm text-text-secondary mt-1">Campaign not found</p>
        </div>
        <RetailCard>
          <div className="py-8 text-center">
            <p className="text-text-secondary">Campaign not found</p>
          </div>
        </RetailCard>
      </div>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title={campaign.name}
          description={`Created ${campaign.createdAt ? format(new Date(campaign.createdAt), 'PPpp') : '—'}`}
          actions={
            ['draft', 'scheduled'].includes(campaign.status) ? (
              <Link href={`/app/retail/campaigns/${campaign.id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            ) : undefined
          }
        />

        <div className="space-y-6">
          {/* Campaign Info */}
          <RetailCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Campaign Details</h2>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <span className="text-sm text-text-secondary">Total Recipients</span>
                <div className="text-lg font-medium text-text-primary">{campaign.total || 0}</div>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <span className="text-sm text-text-secondary">Scheduled For</span>
                  <div className="text-lg font-medium text-text-primary">
                    {format(new Date(campaign.scheduledAt), 'PPpp')}
                  </div>
                </div>
              )}
              {campaign.startedAt && (
                <div>
                  <span className="text-sm text-text-secondary">Started At</span>
                  <div className="text-lg font-medium text-text-primary">
                    {format(new Date(campaign.startedAt), 'PPpp')}
                  </div>
                </div>
              )}
              {campaign.finishedAt && (
                <div>
                  <span className="text-sm text-text-secondary">Finished At</span>
                  <div className="text-lg font-medium text-text-primary">
                    {format(new Date(campaign.finishedAt), 'PPpp')}
                  </div>
                </div>
              )}
            </div>
          </RetailCard>

          {/* Message Preview */}
          {campaign.messageText && (
            <RetailCard>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Message</h3>
              <div className="rounded-lg bg-surface-light p-4">
                <p className="whitespace-pre-wrap text-sm text-text-primary">{campaign.messageText}</p>
              </div>
            </RetailCard>
          )}

          {/* Filters */}
          <RetailCard>
            <h3 className="mb-4 text-lg font-semibold text-text-primary">Audience Filters</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <span className="text-sm text-text-secondary">Gender</span>
                <div className="text-lg font-medium capitalize text-text-primary">
                  {campaign.filterGender || 'All'}
                </div>
              </div>
              <div>
                <span className="text-sm text-text-secondary">Age Group</span>
                <div className="text-lg font-medium text-text-primary">
                  {campaign.filterAgeGroup || 'All'}
                </div>
              </div>
            </div>
          </RetailCard>

          {/* Actions */}
          <RetailCard>
            <h3 className="mb-4 text-lg font-semibold text-text-primary">Actions</h3>
            <CampaignActions
              campaign={campaign}
              onPreviewMessages={() => setPreviewOpen(true)}
              onViewStats={() => router.push(`/app/retail/campaigns/${id}/stats`)}
            />
          </RetailCard>
        </div>

        <MessagePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          messages={previewData?.sample}
          isLoading={previewLoading}
        />
      </div>
    </RetailPageLayout>
  );
}
