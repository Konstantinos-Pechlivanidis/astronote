import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';

/**
 * React Query hook for credit packages
 */
export function useBillingPackages(currency?: string) {
  return useQuery({
    queryKey: ['shopify', 'billing', 'packages', currency],
    queryFn: () => billingApi.getPackages(currency),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}
