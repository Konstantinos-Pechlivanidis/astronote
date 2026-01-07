import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function useJoinInfo(token: string | null) {
  return useQuery({
    queryKey: ['retail', 'public', 'join-info', token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error('token required');
      const res = await publicApi.getJoinInfo(token);
      return res.data;
    },
  });
}
