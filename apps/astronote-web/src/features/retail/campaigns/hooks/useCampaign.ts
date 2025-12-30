import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '@/src/lib/retail/api/campaigns';

export function useCampaign(id: number) {
  return useQuery({
    queryKey: ['retail', 'campaigns', 'detail', id],
    queryFn: async () => {
      const res = await campaignsApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

