'use client';

import { useQuery } from '@tanstack/react-query';
import {
  campaignsApi,
  type Campaign,
} from '@/src/lib/shopify/api/campaigns';

/**
 * React Query hook for getting a single campaign
 */
export function useCampaign(id: string | undefined) {
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  return useQuery<Campaign>({
    queryKey: ['shopify', 'campaigns', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Campaign ID is required');
      const response = await campaignsApi.get(id);
      return response;
    },
    enabled: hasToken && !!id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

