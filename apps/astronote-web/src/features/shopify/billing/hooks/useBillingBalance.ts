import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';

/**
 * React Query hook for billing balance
 */
export function useBillingBalance() {
  return useQuery({
    queryKey: ['shopify', 'billing', 'balance'],
    queryFn: () => billingApi.getBalance(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
