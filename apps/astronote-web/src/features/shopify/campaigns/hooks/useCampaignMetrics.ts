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

/**
 * React Query hook for campaign metrics
 */
export function useCampaignMetrics(id: string | undefined) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignMetrics>({
    queryKey: ['shopify', 'campaigns', id, 'metrics'],
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
    queryKey: ['shopify', 'campaigns', id, 'status'],
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
    refetchInterval: options?.refetchInterval !== false ? 30 * 1000 : false, // Auto-refresh every 30s
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * React Query hook for campaign progress
 */
export function useCampaignProgress(id: string | undefined) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignProgress>({
    queryKey: ['shopify', 'campaigns', id, 'progress'],
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
    refetchInterval: 30 * 1000, // Auto-refresh every 30s for active campaigns
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
    queryKey: ['shopify', 'campaigns', id, 'preview'],
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
    queryKey: ['shopify', 'campaigns', id, 'failed-recipients'],
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

