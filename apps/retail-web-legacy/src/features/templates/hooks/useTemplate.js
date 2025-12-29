import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';
import { queryKeys } from '../../../lib/queryKeys';

/**
 * Hook to fetch single template
 * @param {number} id - Template ID
 */
export function useTemplate(id) {
  return useQuery({
    queryKey: queryKeys.templates.detail(id),
    queryFn: async () => {
      const res = await templatesApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

