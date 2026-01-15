import { useQuery } from '@tanstack/react-query';
import { shopifyBillingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for purchase history (billing transactions)
 * Uses /billing/billing-history endpoint which returns unified purchase history
 */
export function useBillingHistory(params: { page?: number; pageSize?: number; status?: string } = {}) {
  return useQuery({
    queryKey: shopifyQueryKeys.billing.history(params),
    queryFn: () => shopifyBillingApi.getBillingHistory(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
