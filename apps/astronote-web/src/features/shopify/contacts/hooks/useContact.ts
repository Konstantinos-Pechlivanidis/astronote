import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '@/src/lib/shopify/api/contacts';

/**
 * React Query hook for getting a single contact
 */
export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['shopify', 'contacts', 'detail', id],
    queryFn: () => contactsApi.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

