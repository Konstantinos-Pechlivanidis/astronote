import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

// Generate idempotency key per campaign
// BUG FIX: Clear key when campaign can be re-enqueued (draft/scheduled/paused)
// This allows re-enqueue after campaign completes or fails
function generateIdempotencyKey(campaignId, campaignStatus) {
  const storageKey = `enqueue-idempotency-key:${campaignId}`;
  const statusKey = `enqueue-idempotency-status:${campaignId}`;

  // Check if campaign status changed (allows re-enqueue)
  const lastStatus = sessionStorage.getItem(statusKey);
  const canEnqueue = ['draft', 'scheduled', 'paused'].includes(campaignStatus);

  // Clear key if:
  // 1. Campaign status changed to a non-enqueueable state (completed/failed)
  // 2. Campaign can be enqueued but we don't have a key (new attempt)
  // 3. Last status was non-enqueueable and now it's enqueueable (re-enqueue after completion)
  if (lastStatus && lastStatus !== campaignStatus) {
    const lastCanEnqueue = ['draft', 'scheduled', 'paused'].includes(lastStatus);
    if (!lastCanEnqueue && canEnqueue) {
      // Campaign was completed/failed and now can be enqueued again - clear key
      sessionStorage.removeItem(storageKey);
    } else if (lastCanEnqueue && !canEnqueue) {
      // Campaign was enqueueable and now is sending/completed - clear key for next time
      sessionStorage.removeItem(storageKey);
    }
  }

  // Store current status
  sessionStorage.setItem(statusKey, campaignStatus);

  // Generate new key if not exists or if campaign can be enqueued
  let idempotencyKey = sessionStorage.getItem(storageKey);

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
    sessionStorage.setItem(storageKey, idempotencyKey);
  }

  return idempotencyKey;
}

export function useEnqueueCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }) => {
      // BUG FIX: Generate idempotency key that clears when campaign can be re-enqueued
      // This allows re-enqueue after campaign completes or fails
      const idempotencyKey = generateIdempotencyKey(id, status);
      const res = await campaignsApi.enqueue(id, idempotencyKey);
      return res.data;
    },
    retry: false, // Explicitly disable retry for mutations (already default, but making it explicit)
    onSuccess: async (data, variables) => {
      const { id } = variables;

      // CRITICAL FIX: Immediately refetch campaign detail to update status
      // This ensures the button disables immediately after enqueue
      await queryClient.refetchQueries({
        queryKey: queryKeys.campaigns.detail(id),
        exact: true,
      });

      // Also invalidate other related queries
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.status(id) });

      toast.success(`Campaign enqueued. ${data.queued || 0} messages will be sent.`);
    },
    onError: (error) => {
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

