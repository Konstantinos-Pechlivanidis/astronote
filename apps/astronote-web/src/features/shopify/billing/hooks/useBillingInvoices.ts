import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

export function useBillingInvoices(params: { page?: number; pageSize?: number; status?: string } = {}) {
  return useQuery({
    queryKey: shopifyQueryKeys.billing.invoices(params),
    queryFn: () => billingApi.getInvoices(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
