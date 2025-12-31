import { useQuery } from '@tanstack/react-query';
import { automationsApi } from '@/src/lib/shopify/api/automations';

/**
 * React Query hook for automation statistics
 */
export function useAutomationStats() {
  return useQuery({
    queryKey: ['shopify', 'automations', 'stats'],
    queryFn: () => automationsApi.getStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

