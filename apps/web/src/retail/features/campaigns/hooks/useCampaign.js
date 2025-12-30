import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';

export function useCampaign(id) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: async () => {
      const res = await campaignsApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

