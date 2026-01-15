'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  campaignsApi,
  type CampaignListParams,
  type CampaignListResponse,
} from '@/src/lib/shopify/api/campaigns';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for listing campaigns
 */
export function useCampaigns(
  params?: CampaignListParams,
  options?: { refetchInterval?: number | false },
) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignListResponse>({
    queryKey: shopifyQueryKeys.campaigns.list(params || {}),
    queryFn: async () => {
      const response = await campaignsApi.list(params);
      return response;
    },
    enabled: hasToken,
    placeholderData: keepPreviousData,
    staleTime: 5 * 1000, // 5 seconds (list should reflect sends quickly)
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: options?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

