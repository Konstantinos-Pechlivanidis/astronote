import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function useJoinPublicConfig(token: string | null) {
  return useQuery({
    queryKey: ['public', 'join-config', token],
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
    queryFn: async () => {
      if (!token) throw new Error('token required');
      const res = await publicApi.getJoinInfo(token);
      return res.data;
    },
  });
}
