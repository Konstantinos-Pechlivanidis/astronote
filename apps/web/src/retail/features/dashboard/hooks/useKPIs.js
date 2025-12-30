import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../api/modules/dashboard';
import { queryKeys } from '../../../lib/queryKeys';

export function useKPIs() {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis,
    queryFn: async () => {
      const res = await dashboardApi.getKPIs();
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

