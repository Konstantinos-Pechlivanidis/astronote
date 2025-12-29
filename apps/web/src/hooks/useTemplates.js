import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';

/**
 * Hook for templates list (read-only)
 * GET /templates
 * NO association with campaigns - templates are copy/paste only
 */
export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/templates');
      return data?.data || data;
    },
  });
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ['templates', 'categories'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/templates/categories');
      return data;
    },
  });
}

