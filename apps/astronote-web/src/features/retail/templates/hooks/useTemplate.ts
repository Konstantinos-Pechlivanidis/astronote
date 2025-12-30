import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/retail/api/templates';

/**
 * Hook to fetch single template
 * @param id - Template ID
 */
export function useTemplate(id: number | null | undefined) {
  return useQuery({
    queryKey: ['retail', 'templates', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Template ID is required');
      const res = await templatesApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

