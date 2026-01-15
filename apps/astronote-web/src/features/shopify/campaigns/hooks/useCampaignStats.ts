'use client';

import { useQuery } from '@tanstack/react-query';
import {
  campaignsApi,
  type CampaignStatsSummary,
} from '@/src/lib/shopify/api/campaigns';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for campaign stats summary
 */
export function useCampaignStats(options?: { refetchInterval?: number | false }) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<CampaignStatsSummary>({
    queryKey: shopifyQueryKeys.campaigns.stats(),
    queryFn: async () => {
      const response = await campaignsApi.getStatsSummary();
      return response;
    },
    enabled: hasToken,
    staleTime: 5 * 1000, // 5 seconds (stats should reflect sends quickly)
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: options?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

