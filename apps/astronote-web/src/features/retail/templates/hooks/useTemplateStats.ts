import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/retail/api/templates';

export interface TemplateStats {
  total?: number
  sent?: number
  conversions?: number
  conversionRate?: number
  [key: string]: any
}

/**
 * Hook to fetch template statistics
 * @param id - Template ID
 */
export function useTemplateStats(id: number | null | undefined) {
  return useQuery<TemplateStats>({
    queryKey: ['retail', 'templates', 'stats', id],
    queryFn: async () => {
      if (!id) throw new Error('Template ID is required');
      const res = await templatesApi.getStats(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

