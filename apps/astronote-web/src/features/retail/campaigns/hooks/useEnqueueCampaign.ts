import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/src/lib/retail/api/campaigns';
import { toast } from 'sonner';

// Generate idempotency key per campaign
// Clear key when campaign can be re-enqueued (draft/scheduled/paused)
function generateIdempotencyKey(campaignId: number, campaignStatus: string): string {
  const storageKey = `enqueue-idempotency-key:${campaignId}`;
  const statusKey = `enqueue-idempotency-status:${campaignId}`;

  // Check if campaign status changed (allows re-enqueue)
  const lastStatus = typeof window !== 'undefined' ? sessionStorage.getItem(statusKey) : null;
  const canEnqueue = ['draft', 'scheduled', 'paused'].includes(campaignStatus);

  // Clear key if status changed
  if (lastStatus && lastStatus !== campaignStatus && typeof window !== 'undefined') {
    const lastCanEnqueue = ['draft', 'scheduled', 'paused'].includes(lastStatus);
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

export function useEnqueueCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useEnqueueCampaign] mutationFn called', { id, status });
      }
      const idempotencyKey = generateIdempotencyKey(id, status);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useEnqueueCampaign] Generated idempotency key', idempotencyKey);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useEnqueueCampaign] Calling campaignsApi.enqueue', { id, idempotencyKey });
      }
      const res = await campaignsApi.enqueue(id, idempotencyKey);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[useEnqueueCampaign] API response received', res);
      }
      return res.data;
    },
    retry: false, // Explicitly disable retry to prevent double-enqueue
    onSuccess: async (data, variables) => {
      const { id } = variables;

      // Immediately refetch campaign detail to update status
      await queryClient.refetchQueries({
        queryKey: ['retail', 'campaigns', 'detail', id],
        exact: true,
      });

      // Also invalidate other related queries
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'status', id] });

      toast.success(`Campaign enqueued. ${data.queued || 0} messages will be sent.`);
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to enqueue campaign';

      if (code === 'INVALID_STATUS') {
        toast.error('Campaign cannot be sent in its current state');
      } else if (code === 'NO_RECIPIENTS') {
        toast.error('Campaign has no eligible recipients');
      } else if (code === 'ALREADY_SENDING') {
        toast.error('Campaign is already being sent');
      } else if (code === 'INSUFFICIENT_CREDITS') {
        toast.error('Insufficient credits. Please purchase more credits.');
      } else {
        toast.error(message);
      }
    },
  });
}

