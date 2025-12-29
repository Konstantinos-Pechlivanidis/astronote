import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { queryKeys } from '../../../lib/queryKeys';

export function useContacts({ page = 1, pageSize = 20, q = '', isSubscribed = null, listId = null } = {}) {
  const params = {
    page,
    pageSize,
    ...(q && { q }),
    ...(isSubscribed !== null && { isSubscribed: isSubscribed ? 'true' : 'false' }),
    ...(listId && { listId }),
  };

  return useQuery({
    queryKey: queryKeys.contacts.list(params),
    queryFn: async () => {
      const res = await contactsApi.list(params);
      return res.data;
    },
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

