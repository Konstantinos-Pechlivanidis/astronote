'use client';

import { useQuery } from '@tanstack/react-query';
import {
  campaignsApi,
  type CampaignMetrics,
  type CampaignStatusResponse,
  type CampaignProgress,
  type CampaignPreview,
  type FailedRecipientsResponse,
} from '@/src/lib/shopify/api/campaigns';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for campaign metrics
 */
export function useCampaignMetrics(id: string | undefined) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignMetrics>({
    queryKey: shopifyQueryKeys.campaigns.metrics(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.getMetrics(id);
      return response;
    },
    enabled: hasToken && !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook for campaign status (with auto-refresh for active campaigns)
 */
export function useCampaignStatus(
  id: string | undefined,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignStatusResponse>({
    queryKey: shopifyQueryKeys.campaigns.status(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.getStatus(id);
      return response;
    },
    enabled: hasToken && !!id && (options?.enabled !== false),
    staleTime: 15 * 1000, // 15 seconds - status updates frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval:
      options?.refetchInterval !== undefined
        ? options.refetchInterval
        : (data) => {
          const status = (data as any)?.campaign?.status || (data as any)?.status;
          return status === 'sending' || status === 'scheduled' ? 5 * 1000 : false;
        },
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * React Query hook for campaign progress
 */
export function useCampaignProgress(
  id: string | undefined,
  options?: { refetchInterval?: number | false },
) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignProgress>({
    queryKey: shopifyQueryKeys.campaigns.progress(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.getProgress(id);
      return response;
    },
    enabled: hasToken && !!id,
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval:
      options?.refetchInterval !== undefined
        ? options.refetchInterval
        : (data) => {
          const status = (data as any)?.status || (data as any)?.campaign?.status;
          const pending = (data as any)?.pending || (data as any)?.queued || 0;
          return status === 'sending' || pending > 0 ? 5 * 1000 : false;
        },
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * React Query hook for campaign preview
 */
export function useCampaignPreview(id: string | undefined, enabled = false) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignPreview>({
    queryKey: shopifyQueryKeys.campaigns.preview(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.getPreview(id);
      return response;
    },
    enabled: hasToken && !!id && enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook for failed recipients
 */
export function useCampaignFailedRecipients(id: string | undefined, enabled = false) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<FailedRecipientsResponse>({
    queryKey: shopifyQueryKeys.campaigns.failedRecipients(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.getFailedRecipients(id);
      return response;
    },
    enabled: hasToken && !!id && enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
