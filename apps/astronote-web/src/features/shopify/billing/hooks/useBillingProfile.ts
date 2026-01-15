import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

export function useBillingProfile() {
  return useQuery({
    queryKey: shopifyQueryKeys.billing.profile(),
    queryFn: () => billingApi.getProfile(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
