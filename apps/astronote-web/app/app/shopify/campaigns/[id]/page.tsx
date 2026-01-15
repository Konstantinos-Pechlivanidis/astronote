'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { format } from 'date-fns';
import { useCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaign';
import {
  useCampaignMetrics,
  useCampaignStatus,
  useCampaignProgress,
  useCampaignPreview,
  useCampaignFailedRecipients,
} from '@/src/features/shopify/campaigns/hooks/useCampaignMetrics';
import {
  useDeleteCampaign,
  useEnqueueCampaign,
  useCancelCampaign,
  useScheduleCampaign,
} from '@/src/features/shopify/campaigns/hooks/useCampaignMutations';
import { useSubscriptionStatus } from '@/src/features/shopify/billing/hooks/useSubscriptionStatus';
import { useBillingBalance } from '@/src/features/shopify/billing/hooks/useBillingBalance';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { CampaignStatusBadge } from '@/src/components/shopify/CampaignStatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import {
  ArrowLeft,
  Send,
  XCircle,
  Trash2,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  X,
  Calendar,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

/**
 * Campaign Detail Page
 */
export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [showFailedRecipients] = useState(false);

  // Fetch campaign data
  const {
    data: campaign,
    isLoading: campaignLoading,
    error: campaignError,
  } = useCampaign(id);

  // Fetch metrics
  const { data: metrics } = useCampaignMetrics(id);
  const { data: subscriptionData } = useSubscriptionStatus();

  // Fetch status (auto-refresh if sending/scheduled)
  const isActive = campaign?.status === 'sending' || campaign?.status === 'scheduled';
  const { data: statusData } = useCampaignStatus(id, {
    enabled: isActive,
    refetchInterval: isActive ? 2 * 1000 : false, // Fast poll while active
  });

  // Fetch progress (auto-refresh if sending/scheduled)
  const { data: progressData } = useCampaignProgress(id);

  // Credits/balance should refresh quickly while campaign is active (debit happens during send path)
  useBillingBalance({
    enabled: isActive,
    refetchInterval: isActive ? 5 * 1000 : false,
  });

  // Fetch preview (only when modal is open)
  const { data: previewData, isLoading: previewLoading } = useCampaignPreview(
    id,
    showPreviewModal,
  );

  // Fetch failed recipients (only when section is visible)
  const showFailedSection =
    showFailedRecipients &&
    (campaign?.status === 'completed' ||
      campaign?.status === 'sent' ||
      campaign?.status === 'failed' ||
      campaign?.status === 'sending');
  useCampaignFailedRecipients(id, showFailedSection);
  const isSubscriptionActive = subscriptionData?.status === 'active' || subscriptionData?.active === true;
  const previewBlocked = previewData?.reason === 'subscription_required';

  // Mutations
  const deleteCampaign = useDeleteCampaign();
  const enqueueCampaign = useEnqueueCampaign();
  const cancelCampaign = useCancelCampaign();
  const scheduleCampaign = useScheduleCampaign();

  const handleDelete = async () => {
    try {
      await deleteCampaign.mutateAsync(id);
      router.push('/app/shopify/campaigns');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleSend = async () => {
    try {
      if (!isSubscriptionActive) {
        return;
      }
      await enqueueCampaign.mutateAsync(id);
      setShowSendDialog(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleCancel = async () => {
    try {
      await cancelCampaign.mutateAsync(id);
      setShowCancelDialog(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDateTime) {
      return;
    }
    try {
      await scheduleCampaign.mutateAsync({
        id,
        data: {
          scheduleType: 'scheduled',
          scheduleAt: scheduleDateTime,
        },
      });
      setShowScheduleDialog(false);
      setScheduleDateTime('');
    } catch (error) {
      // Error handled by mutation hook
    }
  };


  // Loading state
  if (campaignLoading) {
    return (
      <div>
        <AppPageHeader title="Campaign Details" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <RetailCard key={i} className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-32 animate-pulse rounded bg-surface-light" />
                <div className="h-8 w-24 animate-pulse rounded bg-surface-light" />
              </div>
            </RetailCard>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (campaignError || !campaign) {
    return (
      <div>
        <AppPageHeader title="Campaign Details" />
        <RetailCard variant="danger" className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Campaign Not Found
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              {campaignError instanceof Error
                ? campaignError.message
                : 'The campaign you are looking for does not exist.'}
            </p>
            <Link href="/app/shopify/campaigns">
              <Button variant="outline">Back to Campaigns</Button>
            </Link>
          </div>
        </RetailCard>
      </div>
    );
  }

  const canSend = ['draft', 'scheduled', 'cancelled'].includes(campaign.status);
  const canCancel = campaign.status === 'sending' || campaign.status === 'scheduled';
  const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/app/shopify/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
            Back
            </Button>
          </Link>
          <div className="flex-1">
            <AppPageHeader
              title={campaign.name}
              description="Campaign details and metrics"
            />
          </div>
          <div className="flex items-center gap-2">
            {canSend && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewModal(true)}
                  disabled={previewLoading}
                >
                  <Eye className="mr-2 h-4 w-4" />
                Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowScheduleDialog(true)}
                  disabled={scheduleCampaign.isPending}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                Schedule
                </Button>
                <Button
                  onClick={() => setShowSendDialog(true)}
                  disabled={!isSubscriptionActive || enqueueCampaign.isPending}
                  title={!isSubscriptionActive ? 'Active subscription required to send campaigns' : 'Send campaign'}
                >
                  <Send className="mr-2 h-4 w-4" />
                Send Now
                </Button>
              </>
            )}
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelCampaign.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
              Cancel
              </Button>
            )}
            {canEdit && (
              <Link href={`/app/shopify/campaigns/${id}/edit`}>
                <Button variant="outline">Edit</Button>
              </Link>
            )}
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteCampaign.isPending}
              className="text-red-400 hover:text-red-500"
            >
              <Trash2 className="mr-2 h-4 w-4" />
            Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Campaign Info Card */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Campaign Information</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Status</div>
                <CampaignStatusBadge
                  status={campaign.status}
                  scheduleType={campaign.scheduleType}
                  scheduleAt={campaign.scheduleAt}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Recipients</div>
                <div className="text-text-primary">{campaign.recipientCount || 0} recipients</div>
              </div>
              {campaign.scheduleAt && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Scheduled</div>
                  <div className="text-text-primary">
                    {format(new Date(campaign.scheduleAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Created</div>
                <div className="text-text-primary">
                  {format(new Date(campaign.createdAt), 'MMM d, yyyy HH:mm')}
                </div>
              </div>
              {campaign.startedAt && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Started</div>
                  <div className="text-text-primary">
                    {format(new Date(campaign.startedAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
              {campaign.finishedAt && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Finished</div>
                  <div className="text-text-primary">
                    {format(new Date(campaign.finishedAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              )}
            </div>
          </RetailCard>

          {/* Message Card */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Message</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-surface-light border border-border">
                <p className="text-sm text-text-primary whitespace-pre-wrap">{campaign.message}</p>
              </div>
              <div className="text-xs text-text-tertiary">
                {campaign.message.length} characters
              </div>
            </div>
          </RetailCard>

          {/* Metrics Card */}
          {metrics && (
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
              Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Total</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {metrics.totals?.recipients ?? (metrics as any).totalRecipients ?? metrics.total ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Accepted</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {metrics.accepted ?? metrics.sent ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Failed</div>
                  <div className="text-2xl font-bold text-red-400">
                    {metrics.delivery?.failedDelivery ?? metrics.failed ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Delivered</div>
                  <div className="text-2xl font-bold text-green-400">
                    {metrics.delivery?.delivered ?? metrics.delivered ?? 0}
                  </div>
                </div>
                {metrics.conversionRate !== undefined && (
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-1">Conversion Rate</div>
                    <div className="text-2xl font-bold text-accent">
                      {(metrics.conversionRate * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </RetailCard>
          )}

          {/* Status Card (if sending/scheduled) */}
          {statusData && isActive && (
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
              Status
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Queued</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statusData.canonical?.queued ?? statusData.metrics?.queued ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Accepted</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {statusData.canonical?.totals?.accepted ?? statusData.metrics?.success ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Delivered</div>
                  <div className="text-2xl font-bold text-green-400">
                    {statusData.canonical?.delivery?.delivered ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Failed</div>
                  <div className="text-2xl font-bold text-red-400">
                    {statusData.canonical?.delivery?.failedDelivery ?? statusData.metrics?.failed ?? 0}
                  </div>
                </div>
              </div>
            </RetailCard>
          )}

          {/* Progress Card (if sending) */}
          {progressData && campaign.status === 'sending' && (
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
              Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary">Progress</span>
                    <span className="text-sm font-medium text-text-primary">
                      {progressData.percentage ?? progressData.progress ?? 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-light rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${progressData.percentage ?? progressData.progress ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-1">Accepted</div>
                    <div className="text-lg font-bold text-blue-400">{progressData.accepted ?? progressData.sent ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-1">Failed</div>
                    <div className="text-lg font-bold text-red-400">{progressData.failedDelivery ?? progressData.failed ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-1">Pending delivery</div>
                    <div className="text-lg font-bold text-yellow-400">{progressData.pendingDelivery ?? 0}</div>
                  </div>
                </div>
              </div>
            </RetailCard>
          )}

          {/* Delivery Breakdown Card */}
          {metrics && (campaign.status === 'completed' || campaign.status === 'sent' || campaign.status === 'sending' || campaign.status === 'failed') && (
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
              Delivery Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Total Recipients</div>
                  <div className="text-2xl font-bold text-text-primary">
                    {metrics.totals?.recipients ?? (metrics as any).totalRecipients ?? metrics.total ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Accepted</div>
                  <div className="text-2xl font-bold text-blue-400">{metrics.accepted ?? metrics.sent ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Failed</div>
                  <div className="text-2xl font-bold text-red-400">{metrics.delivery?.failedDelivery ?? metrics.failed ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Delivered</div>
                  <div className="text-2xl font-bold text-green-400">{metrics.delivery?.delivered ?? metrics.delivered ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Pending Delivery</div>
                  <div className="text-2xl font-bold text-yellow-400">{metrics.pendingDelivery ?? metrics.delivery?.pendingDelivery ?? 0}</div>
                </div>
              </div>
            </RetailCard>
          )}

          {/* Quick Actions */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={`/app/shopify/campaigns/${id}/stats`}>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="mr-2 h-4 w-4" />
                View Stats
                </Button>
              </Link>
              <Link href={`/app/shopify/campaigns/${id}/status`}>
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" />
                View Status
                </Button>
              </Link>
            </div>
          </RetailCard>
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title="Delete Campaign"
          message={`Are you sure you want to delete "${campaign.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />

        {/* Send Confirmation Dialog */}
        <ConfirmDialog
          open={showSendDialog}
          onClose={() => setShowSendDialog(false)}
          onConfirm={handleSend}
          title="Send Campaign"
          message={`Are you sure you want to send "${campaign.name}"? This will start sending SMS messages immediately.`}
          confirmText="Send"
          cancelText="Cancel"
        />

        {/* Cancel Confirmation Dialog */}
        <ConfirmDialog
          open={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={handleCancel}
          title="Cancel Campaign"
          message={`Are you sure you want to cancel "${campaign.name}"? Pending messages will not be sent.`}
          confirmText="Cancel Campaign"
          cancelText="Keep Sending"
          variant="danger"
        />

        {/* Schedule Dialog */}
        {showScheduleDialog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowScheduleDialog(false)} />
              <RetailCard className="relative z-10 max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-text-primary">Schedule Campaign</h2>
                  <button
                    onClick={() => setShowScheduleDialog(false)}
                    className="text-text-tertiary hover:text-text-primary"
                    aria-label="Close schedule dialog"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                    Date & Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full"
                    />
                    <p className="mt-1 text-xs text-text-tertiary">
                    Select a future date and time to schedule this campaign
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowScheduleDialog(false)}
                      className="flex-1"
                    >
                    Cancel
                    </Button>
                    <Button
                      onClick={handleSchedule}
                      disabled={!scheduleDateTime || scheduleCampaign.isPending}
                      className="flex-1"
                    >
                      {scheduleCampaign.isPending ? 'Scheduling...' : 'Schedule'}
                    </Button>
                  </div>
                </div>
              </RetailCard>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowPreviewModal(false)} />
              <RetailCard className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-text-primary">Campaign Preview</h2>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-text-tertiary hover:text-text-primary"
                    aria-label="Close preview modal"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                {previewLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
                    <p className="text-sm text-text-secondary">Loading preview...</p>
                  </div>
                ) : previewData ? (
                  previewBlocked ? (
                    <RetailCard variant="danger" className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <h3 className="font-semibold text-text-primary">Subscription Required</h3>
                      </div>
                      <p className="text-sm text-text-secondary">
                      Active subscription required to send campaigns. Please subscribe to a plan to continue.
                      </p>
                    </RetailCard>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-text-secondary mb-1">Recipients</div>
                          <div className="text-2xl font-bold text-text-primary">
                            {(previewData.recipientCount ?? 0).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-secondary mb-1">Estimated Cost</div>
                          <div className="text-2xl font-bold text-accent">
                            {(previewData.estimatedCost ?? 0).toLocaleString()} credits
                          </div>
                        </div>
                      </div>

                      {previewData.insufficientCredits && (
                        <RetailCard variant="danger" className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-red-400" />
                            <h3 className="font-semibold text-text-primary">Insufficient Credits</h3>
                          </div>
                          <p className="text-sm text-text-secondary">
                          You need {(previewData.missingCredits ?? 0).toLocaleString()} more credits to send this campaign.
                          </p>
                        </RetailCard>
                      )}

                      {previewData.errors && previewData.errors.length > 0 && (
                        <RetailCard variant="danger" className="p-4">
                          <h3 className="font-semibold text-text-primary mb-2">Errors</h3>
                          <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                            {previewData.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </RetailCard>
                      )}

                      {previewData.canSend && (
                        <div className="pt-4 border-t border-border">
                          <p className="text-sm text-text-secondary mb-4">
                          This campaign is ready to send. Click &quot;Send&quot; to start sending messages.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-secondary">Failed to load preview</p>
                  </div>
                )}
              </RetailCard>
            </div>
          </div>
        )}
      </div>
    </RetailPageLayout>
  );
}
