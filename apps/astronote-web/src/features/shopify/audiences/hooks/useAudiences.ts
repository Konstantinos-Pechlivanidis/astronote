import { useQuery } from '@tanstack/react-query';
import { audiencesApi } from '@/src/lib/shopify/api/audiences';

/**
 * React Query hook for listing audiences
 */
export function useAudiences() {
  return useQuery({
    queryKey: ['shopify', 'audiences', 'list'],
    queryFn: () => audiencesApi.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

