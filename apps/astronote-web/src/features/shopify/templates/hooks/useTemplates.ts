import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { templatesApi, type TemplatesListParams } from '@/src/lib/shopify/api/templates';

/**
 * React Query hook for listing templates
 */
export function useTemplates(params?: TemplatesListParams) {
  return useQuery({
    queryKey: ['shopify', 'templates', 'list', params],
    queryFn: () => templatesApi.list(params),
    staleTime: 15 * 60 * 1000, // 15 minutes - templates rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData, // Smooth pagination
  });
}

