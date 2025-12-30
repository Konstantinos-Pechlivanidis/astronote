import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';

export function useCampaignStats(id) {
  return useQuery({
    queryKey: queryKeys.campaigns.stats(id),
    queryFn: async () => {
      const res = await campaignsApi.getStats(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

