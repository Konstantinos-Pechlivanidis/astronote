import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';

export function useRecentCampaigns() {
  return useQuery({
    queryKey: queryKeys.dashboard.recentCampaigns,
    queryFn: async () => {
      const res = await campaignsApi.list({
        page: 1,
        pageSize: 5,
        orderBy: 'createdAt',
        order: 'desc',
        withStats: true,
      });
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

