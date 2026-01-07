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
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (!data) return false;
      const metrics = data.metrics || {};
      const queued = metrics.queued || 0;
      const pending = metrics.pendingDelivery || 0;
      const status = data.campaign?.status;
      if (status === 'sending' || queued > 0 || pending > 0) {
        return 3000; // poll every 3s while work remains
      }
      return false;
    },
    staleTime: 0,
  });
}
