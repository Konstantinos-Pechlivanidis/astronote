import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '@/src/lib/retail/api/campaigns';

export function useCampaignPreview(id: number) {
  return useQuery({
    queryKey: ['retail', 'campaigns', 'preview', id],
    queryFn: async () => {
      const res = await campaignsApi.getPreview(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

