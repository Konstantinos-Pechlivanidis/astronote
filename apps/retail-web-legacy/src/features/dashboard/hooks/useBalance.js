import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';

/**
 * Get balance and subscription (for dashboard)
 * Returns normalized: { credits: number, subscription: {...} }
 */
export function useBalance() {
  return useQuery({
    queryKey: queryKeys.dashboard.balance,
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data; // Already normalized by billingApi
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

