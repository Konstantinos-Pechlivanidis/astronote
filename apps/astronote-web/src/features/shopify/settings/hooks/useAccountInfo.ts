import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/src/lib/shopify/api/settings';

/**
 * React Query hook for account info
 */
export function useAccountInfo() {
  return useQuery({
    queryKey: ['shopify', 'settings', 'account'],
    queryFn: () => settingsApi.getAccountInfo(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

