import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/shopify/api/templates';

/**
 * React Query hook for getting a single template
 */
export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['shopify', 'templates', 'detail', id],
    queryFn: () => templatesApi.get(id!),
    enabled: !!id,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

