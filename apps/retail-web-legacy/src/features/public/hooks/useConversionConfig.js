import { useQuery } from '@tanstack/react-query';
import { conversionApi } from '../../../api/modules/conversion';

export function useConversionConfig(tagPublicId) {
  return useQuery({
    queryKey: ['public', 'conversion', 'config', tagPublicId],
    queryFn: async () => {
      const res = await conversionApi.getConfig(tagPublicId);
      return res.data;
    },
    enabled: !!tagPublicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

