import { useQuery } from '@tanstack/react-query';
import { discountsApi } from '@/src/lib/shopify/api/discounts';

/**
 * React Query hook for listing discounts
 */
export function useDiscounts() {
  return useQuery({
    queryKey: ['shopify', 'discounts', 'list'],
    queryFn: () => discountsApi.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes - discounts change occasionally
    gcTime: 20 * 60 * 1000, // 20 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

