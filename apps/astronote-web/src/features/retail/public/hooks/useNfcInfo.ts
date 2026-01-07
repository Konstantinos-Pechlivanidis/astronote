import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function useNfcInfo(token: string | null) {
  return useQuery({
    queryKey: ['retail', 'public', 'nfc', token],
    enabled: !!token,
    queryFn: async () => {
      if (!token) throw new Error('token required');
      const res = await publicApi.getNfcInfo(token);
      return res.data;
    },
  });
}
