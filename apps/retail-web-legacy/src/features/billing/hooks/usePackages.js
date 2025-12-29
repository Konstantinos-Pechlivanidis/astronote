import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';

export function usePackages(currency = 'EUR') {
  return useQuery({
    queryKey: queryKeys.billing.packages,
    queryFn: async () => {
      const res = await billingApi.getPackages(currency);
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

