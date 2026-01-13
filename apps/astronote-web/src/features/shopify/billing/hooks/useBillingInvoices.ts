import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/shopifyBillingApi';

export function useBillingInvoices(params: { page?: number; pageSize?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['shopify', 'billing', 'invoices', params],
    queryFn: () => billingApi.getInvoices(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
