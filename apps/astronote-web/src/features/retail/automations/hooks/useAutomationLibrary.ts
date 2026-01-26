import { useQuery } from '@tanstack/react-query';
import { automationLibraryApi } from '@/src/lib/retail/api/automationLibrary';

export function useAutomationLibrary() {
  return useQuery({
    queryKey: ['retail', 'automation-library'],
    queryFn: async () => {
      const res = await automationLibraryApi.list();
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}
