import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for subscription status
 */
export function useSubscriptionStatus() {
  return useQuery({
    queryKey: shopifyQueryKeys.subscriptions.status(),
    queryFn: () => subscriptionsApi.getStatus(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
