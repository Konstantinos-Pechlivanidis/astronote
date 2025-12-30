import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';

export function useCampaignPreview(id) {
  return useQuery({
    queryKey: queryKeys.campaigns.preview(id),
    queryFn: async () => {
      const res = await campaignsApi.getPreview(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

