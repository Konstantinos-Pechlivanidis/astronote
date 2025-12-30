import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function useRedeemStatus(trackingId: string | null) {
  return useQuery({
    queryKey: ['retail', 'public', 'redeem', trackingId],
    queryFn: async () => {
      if (!trackingId) throw new Error('trackingId is required');
      const res = await publicApi.getRedeemStatus(trackingId);
      return res.data;
    },
    enabled: !!trackingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

