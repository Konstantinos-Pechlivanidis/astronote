import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function useOffer(trackingId: string | null) {
  return useQuery({
    queryKey: ['retail', 'public', 'offer', trackingId],
    queryFn: async () => {
      if (!trackingId) throw new Error('trackingId is required');
      const res = await publicApi.getOffer(trackingId);
      return res.data;
    },
    enabled: !!trackingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

