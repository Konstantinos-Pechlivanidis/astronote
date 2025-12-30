import { useQuery } from '@tanstack/react-query';
import { publicContactsApi } from '../../../api/modules/publicContacts';

export function usePreferences(pageToken) {
  return useQuery({
    queryKey: ['public', 'preferences', pageToken],
    queryFn: async () => {
      const res = await publicContactsApi.getPreferences(pageToken);
      return res.data;
    },
    enabled: !!pageToken,
    staleTime: 2 * 60 * 1000, // 2 minutes (pageToken is short-lived)
    retry: 1,
  });
}

