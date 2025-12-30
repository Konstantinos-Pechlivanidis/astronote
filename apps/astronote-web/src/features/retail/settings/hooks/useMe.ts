import { useQuery } from '@tanstack/react-query';
import { meApi } from '@/src/lib/retail/api/me';

/**
 * Get current user profile
 */
export function useMe() {
  return useQuery({
    queryKey: ['retail', 'me'],
    queryFn: async () => {
      const res = await meApi.get();
      return res.data.user; // Backend returns { user: {...} }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

