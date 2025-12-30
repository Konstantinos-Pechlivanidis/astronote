import { useQuery } from '@tanstack/react-query';
import { campaignsApi } from '@/src/lib/retail/api/campaigns';

export function useCampaignStatus(id: number) {
  return useQuery({
    queryKey: ['retail', 'campaigns', 'status', id],
    queryFn: async () => {
      const res = await campaignsApi.getStatus(id);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll every 3 seconds if campaign is sending or scheduled (within 1 hour)
      const data = query.state.data;
      if (!data) return false;

      const status = data.campaign?.status;
      if (status === 'sending') {
        return 3000; // Poll every 3 seconds while sending
      }

      if (status === 'scheduled' && data.campaign?.scheduledAt) {
        const scheduledAt = new Date(data.campaign.scheduledAt);
        const now = new Date();
        const diffMs = scheduledAt.getTime() - now.getTime();
        // Poll if scheduled within next hour
        if (diffMs > 0 && diffMs < 3600000) {
          return 3000;
        }
      }

      // Stop polling for completed, failed, paused, draft
      return false;
    },
    staleTime: 0, // Always refetch for status
  });
}

