import { useQuery } from '@tanstack/react-query';
import { contactsApi, type ContactsListParams } from '@/src/lib/retail/api/contacts';

export function useContacts(params?: ContactsListParams) {
  return useQuery({
    queryKey: ['retail', 'contacts', 'list', params],
    queryFn: async () => {
      const res = await contactsApi.list(params);
      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

