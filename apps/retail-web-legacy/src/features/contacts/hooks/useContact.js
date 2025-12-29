import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { queryKeys } from '../../../lib/queryKeys';

export function useContact(id) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: async () => {
      const res = await contactsApi.get(id);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

