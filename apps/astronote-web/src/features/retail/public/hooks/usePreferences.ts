import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export function usePreferences(pageToken: string | null) {
  return useQuery({
    queryKey: ['retail', 'public', 'preferences', pageToken],
    queryFn: async () => {
      if (!pageToken) throw new Error('pageToken is required');
      const res = await publicApi.getPreferences(pageToken);
      return res.data;
    },
    enabled: !!pageToken,
    staleTime: 2 * 60 * 1000, // 2 minutes (pageToken is short-lived)
    retry: 1,
  });
}

