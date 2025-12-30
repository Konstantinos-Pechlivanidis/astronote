import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '@/src/lib/retail/api/campaigns';

export function useCampaignStats(id: number) {
  return useQuery({
    queryKey: ['retail', 'campaigns', 'stats', id],
    queryFn: async () => {
      const res = await campaignsApi.getStats(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
}

