import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';

export function useCampaigns({ page = 1, pageSize = 20, q = '', status = null } = {}) {
  const params = {
    page,
    pageSize,
    ...(q && { q }),
    ...(status && status !== 'all' && { status }),
    withStats: true,
  };

  return useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: async () => {
      const res = await campaignsApi.list(params);
      return res.data;
    },
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

