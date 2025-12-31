import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { contactsApi, type ContactsListParams } from '@/src/lib/shopify/api/contacts';

/**
 * React Query hook for listing contacts
 */
export function useContacts(params?: ContactsListParams) {
  return useQuery({
    queryKey: ['shopify', 'contacts', 'list', params],
    queryFn: () => contactsApi.list(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: keepPreviousData, // Smooth pagination
  });
}

