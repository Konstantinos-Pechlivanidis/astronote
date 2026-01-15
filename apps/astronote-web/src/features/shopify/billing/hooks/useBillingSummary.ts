import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for billing summary
 */
export function useBillingSummary() {
  return useQuery({
    queryKey: shopifyQueryKeys.billing.summary(),
    queryFn: () => billingApi.getSummary(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
