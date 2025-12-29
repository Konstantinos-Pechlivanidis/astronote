import { useQuery } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';

/**
 * Hook for retail templates list (read-only, copy/paste only)
 * GET /templates
 */
export function useRetailTemplates() {
  return useQuery({
    queryKey: ['retail', 'templates'],
    queryFn: async () => {
      const { data } = await axiosRetail.get('/templates');
      return data?.data || data;
    },
  });
}

