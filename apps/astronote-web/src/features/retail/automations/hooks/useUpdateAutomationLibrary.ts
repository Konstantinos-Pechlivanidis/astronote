import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationLibraryApi, type AutomationLibraryUpdatePayload } from '@/src/lib/retail/api/automationLibrary';
import { toast } from 'sonner';

export function useUpdateAutomationLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, data }: { key: string; data: AutomationLibraryUpdatePayload }) => {
      const res = await automationLibraryApi.update(key, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'automation-library'] });
      toast.success('Automation updated');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update automation';
      toast.error(message);
    },
  });
}
