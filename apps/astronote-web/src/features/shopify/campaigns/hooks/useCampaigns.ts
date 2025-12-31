'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  campaignsApi,
  type CampaignListParams,
  type CampaignListResponse,
} from '@/src/lib/shopify/api/campaigns';

/**
 * React Query hook for listing campaigns
 */
export function useCampaigns(params?: CampaignListParams) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignListResponse>({
    queryKey: ['shopify', 'campaigns', 'list', params],
    queryFn: async () => {
      const response = await campaignsApi.list(params);
      return response;
    },
    enabled: hasToken,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

