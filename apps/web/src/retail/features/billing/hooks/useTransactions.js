import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';

export function useTransactions({ page = 1, pageSize = 20 } = {}) {
  return useQuery({
    queryKey: queryKeys.billing.transactions({ page, pageSize }),
    queryFn: async () => {
      const res = await billingApi.getTransactions({ page, pageSize });
      return res.data;
    },
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

