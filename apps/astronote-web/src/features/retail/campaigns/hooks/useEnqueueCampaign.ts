import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CampaignEnqueueResponse, campaignsApi } from '@/src/lib/retail/api/campaigns';
import { toast } from 'sonner';

// Generate idempotency key per campaign
// Clear key when campaign can be re-enqueued (draft/scheduled)
function generateIdempotencyKey(campaignId: number, campaignStatus: string): string {
  const storageKey = `enqueue-idempotency-key:${campaignId}`;
  const statusKey = `enqueue-idempotency-status:${campaignId}`;

  // Check if campaign status changed (allows re-enqueue)
  const lastStatus = typeof window !== 'undefined' ? sessionStorage.getItem(statusKey) : null;
  const canEnqueue = ['draft', 'scheduled'].includes(campaignStatus);

  // Clear key if status changed
  if (lastStatus && lastStatus !== campaignStatus && typeof window !== 'undefined') {
    const lastCanEnqueue = ['draft', 'scheduled'].includes(lastStatus);
    if (!lastCanEnqueue && canEnqueue) {
      sessionStorage.removeItem(storageKey);
    } else if (lastCanEnqueue && !canEnqueue) {
      sessionStorage.removeItem(storageKey);
    }
  }

  // Store current status
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(statusKey, campaignStatus);
  }

  // Generate new key if not exists or if campaign can be enqueued
  let idempotencyKey =
    typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;

  if (!idempotencyKey || canEnqueue) {
    // Generate new key for this enqueue attempt
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      idempotencyKey = crypto.randomUUID();
    } else {
      // Fallback for older browsers
      idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, idempotencyKey);
    }
  }

  return idempotencyKey!;
}

function extractStatusFromMessage(message?: string) {
  if (!message) return null;
  const match = message.match(/invalid_status:([a-z_]+)/i);
  return match ? match[1] : null;
}

export function useEnqueueCampaign() {
  const queryClient = useQueryClient();

  return useMutation<CampaignEnqueueResponse, any, { id: number; status: string }>({
    mutationFn: async ({ id, status }) => {
      if (!['draft', 'scheduled'].includes(status)) {
        const error = new Error(`invalid_status:${status}`);
        (error as any).code = 'INVALID_STATUS';
        (error as any).currentStatus = status;
        throw error;
      }
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[useEnqueueCampaign] mutationFn called', { id, status });
      }
      const idempotencyKey = generateIdempotencyKey(id, status);
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[useEnqueueCampaign] Generated idempotency key', idempotencyKey);
      }
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[useEnqueueCampaign] Request start', { id, idempotencyKey });
      }
      const res = await campaignsApi.enqueue(id, idempotencyKey);
      // eslint-disable-next-line no-console
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[useEnqueueCampaign] API response received', res?.data || res);
      }
      return res.data;
    },
    retry: false, // Explicitly disable retry to prevent double-enqueue
    onSuccess: async (data, variables) => {
      const { id } = variables;
      const queued = data?.queued || 0;
      const enqueuedJobs = typeof data?.enqueuedJobs === 'number' ? data.enqueuedJobs : null;

      // Immediately refetch campaign detail to update status
      await queryClient.refetchQueries({
        queryKey: ['retail', 'campaigns', 'detail', id],
        exact: true,
      });

      // Also invalidate other related queries
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'status', id] });
      // Keep dashboard + billing in sync (credits/allowance + KPIs)
      queryClient.invalidateQueries({ queryKey: ['retail-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['retail-balance'] });
      queryClient.invalidateQueries({ queryKey: ['retail-billing-summary'] });

      const summary = enqueuedJobs !== null
        ? `${queued} messages (${enqueuedJobs} jobs enqueued)`
        : `${queued} messages`;
      toast.success(`Campaign enqueued. ${summary}.`);
    },
    onError: (error: any) => {
      const code = error.response?.data?.code || error.code;
      const message = error.response?.data?.message || error.message || 'Failed to enqueue campaign';
      const statusFromMessage = extractStatusFromMessage(message);
      const currentStatus = error.response?.data?.currentStatus || error.currentStatus || statusFromMessage;

      if (code === 'INVALID_STATUS' || code === 'ENQUEUE_CONFLICT_STATUS') {
        if (currentStatus === 'failed') {
          toast.error('Campaign failed. Create a new campaign or contact support.');
        } else if (currentStatus === 'sending') {
          toast.info('Campaign is already sending. Check status for progress.');
        } else if (currentStatus === 'completed') {
          toast.info('Campaign already completed. Create a new campaign to send again.');
        } else if (currentStatus === 'scheduled') {
          toast.info('Campaign is scheduled. Use "Enqueue now" to send immediately or edit the schedule.');
        } else {
          toast.error(
            currentStatus
              ? `Campaign cannot be sent in its current state (${currentStatus}).`
              : 'Campaign cannot be sent in its current state.',
          );
        }
      } else if (code === 'NO_RECIPIENTS') {
        toast.error('Campaign has no eligible recipients');
      } else if (code === 'ALREADY_SENDING') {
        toast.error('Campaign is already being sent');
      } else if (code === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough free allowance or credits. Please purchase more credits or upgrade your subscription.');
      } else if (code === 'QUEUE_UNAVAILABLE') {
        toast.error('Message queue unavailable. Please try again in a moment.');
      } else if (code === 'ENQUEUE_FAILED') {
        toast.error('Failed to enqueue campaign. Please retry.');
      } else if (code === 'SUBSCRIPTION_REQUIRED' || code === 'INACTIVE_SUBSCRIPTION') {
        toast.error('Active subscription required to send campaigns.');
      } else if (code === 'NO_MESSAGE_TEXT') {
        toast.error('Campaign is missing message text.');
      } else {
        toast.error(message);
      }
    },
  });
}
