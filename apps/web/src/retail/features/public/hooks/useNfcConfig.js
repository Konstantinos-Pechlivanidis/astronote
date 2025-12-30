import { useQuery } from '@tanstack/react-query';
import { nfcApi } from '../../../api/modules/nfc';

export function useNfcConfig(publicId) {
  return useQuery({
    queryKey: ['public', 'nfc', 'config', publicId],
    queryFn: async () => {
      const res = await nfcApi.getConfig(publicId);
      return res.data;
    },
    enabled: !!publicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

