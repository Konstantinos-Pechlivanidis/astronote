import { useQuery } from '@tanstack/react-query';
import { listsApi } from '@/src/lib/retail/api/lists';

/**
 * Hook to fetch system lists only (read-only, for filtering)
 * Returns lists with isSystem: true
 */
export function useSystemLists() {
  return useQuery({
    queryKey: ['retail', 'lists', 'system'],
    queryFn: async () => {
      const res = await listsApi.getSystemLists();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - system lists don't change often
  });
}

