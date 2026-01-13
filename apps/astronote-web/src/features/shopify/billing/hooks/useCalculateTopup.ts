import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';

/**
 * React Query hook for calculating top-up price
 */
export function useCalculateTopup(credits: number | null, currency?: string) {
  return useQuery({
    queryKey: ['shopify', 'billing', 'topup', 'calculate', credits, currency],
    queryFn: () => billingApi.calculateTopup(credits!, currency),
    enabled: !!credits && credits > 0 && credits <= 1000000,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
