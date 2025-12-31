import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/shopify/api/templates';

/**
 * React Query hook for template categories
 */
export function useTemplateCategories() {
  return useQuery({
    queryKey: ['shopify', 'templates', 'categories'],
    queryFn: () => templatesApi.getCategories(),
    staleTime: Infinity, // Never stale - categories are static
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

