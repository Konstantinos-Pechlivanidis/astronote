import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '../../../api/modules/tracking';

export function useOffer(trackingId) {
  return useQuery({
    queryKey: ['public', 'offer', trackingId],
    queryFn: async () => {
      const res = await trackingApi.getOffer(trackingId);
      return res.data;
    },
    enabled: !!trackingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

