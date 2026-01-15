import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for billing balance
 */
export function useBillingBalance(options: {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
} = {}) {
  return useQuery({
    queryKey: shopifyQueryKeys.billing.balance(),
    queryFn: () => billingApi.getBalance(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
    ...options,
  });
}
