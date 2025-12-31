import { useQuery } from '@tanstack/react-query';
import { automationsApi } from '@/src/lib/shopify/api/automations';

/**
 * React Query hook for listing automations
 */
export function useAutomations() {
  return useQuery({
    queryKey: ['shopify', 'automations', 'list'],
    queryFn: () => automationsApi.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

