import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '@/src/lib/shopify/api/contacts';

/**
 * React Query hook for contact statistics
 */
export function useContactStats() {
  return useQuery({
    queryKey: ['shopify', 'contacts', 'stats'],
    queryFn: () => contactsApi.getStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes - stats don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData, // Show cached stats while fetching
  });
}

