'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  campaignsApi,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
  type ScheduleCampaignRequest,
} from '@/src/lib/shopify/api/campaigns';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for creating a campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCampaignRequest) => {
      const response = await campaignsApi.create(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate campaigns list + stats (dashboard KPIs may depend on these)
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Campaign created successfully');
      // Don't auto-redirect - let the component handle it based on action
      // router.push(`/app/shopify/campaigns/${data.id}`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create campaign';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for updating a campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCampaignRequest }) => {
      const response = await campaignsApi.update(id, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: shopifyQueryKeys.campaigns.detail(String(data.id)),
        });
      }

      toast.success('Campaign updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update campaign';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for deleting a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await campaignsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Campaign deleted successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to delete campaign';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for enqueueing (sending) a campaign
 */
export function useEnqueueCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await campaignsApi.enqueue(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.detail(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.metrics(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.status(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.progress(id) });
      // Credits are consumed during campaign send; keep balance fresh.
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Campaign queued for sending');
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to send campaign';

      if (code === 'INVALID_STATUS') {
        toast.error('Campaign cannot be sent in its current state');
      } else if (code === 'NO_RECIPIENTS') {
        toast.error('Campaign has no eligible recipients');
      } else if (code === 'ALREADY_SENDING') {
        toast.error('Campaign is already being sent');
      } else if (code === 'SUBSCRIPTION_REQUIRED') {
        toast.error('Active subscription required to send campaigns.');
      } else if (code === 'INSUFFICIENT_CREDITS') {
        toast.error('Insufficient credits. Please purchase more credits.');
      } else {
        toast.error(message);
      }
    },
  });
}

/**
 * React Query hook for scheduling a campaign
 */
export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ScheduleCampaignRequest }) => {
      const response = await campaignsApi.schedule(id, data);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: shopifyQueryKeys.campaigns.detail(String(data.id)),
        });
      }

      toast.success('Campaign scheduled successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to schedule campaign';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for canceling a campaign
 */
export function useCancelCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await campaignsApi.cancel(id);
      return response;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.detail(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.status(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.progress(id) });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Campaign cancelled successfully');
    },
    onError: (error: any) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to cancel campaign';

      if (code === 'INVALID_STATUS') {
        toast.error('Campaign cannot be cancelled in its current state');
      } else {
        toast.error(message);
      }
    },
  });
}

/**
 * React Query hook for retrying failed recipients
 */
export function useRetryFailedCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await campaignsApi.retryFailedRecipients(id);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.root() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.detail(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.metrics(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.status(id) });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.campaigns.progress(id) });
      queryClient.invalidateQueries({
        queryKey: shopifyQueryKeys.campaigns.failedRecipients(id),
      });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Failed recipients queued for retry');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to retry failed recipients';
      toast.error(message);
    },
  });
}
