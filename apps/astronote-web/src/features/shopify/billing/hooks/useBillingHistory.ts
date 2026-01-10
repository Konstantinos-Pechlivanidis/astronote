import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';

/**
 * React Query hook for transaction history
 */
export function useBillingHistory(params: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['shopify', 'billing', 'history', params],
    queryFn: () => billingApi.getHistory(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
