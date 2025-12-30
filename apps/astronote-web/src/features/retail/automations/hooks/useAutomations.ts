import { useQuery } from '@tanstack/react-query';
import { automationsApi } from '@/src/lib/retail/api/automations';

export function useAutomations() {
  return useQuery({
    queryKey: ['retail', 'automations', 'list'],
    queryFn: async () => {
      const res = await automationsApi.list();
      return res.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

