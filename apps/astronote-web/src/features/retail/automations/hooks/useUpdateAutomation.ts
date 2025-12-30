import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationsApi, type Automation } from '@/src/lib/retail/api/automations';
import { toast } from 'sonner';

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, data }: { type: string; data: Partial<Automation> }) => {
      const res = await automationsApi.update(type, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'automations', 'list'] });
      toast.success('Automation updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update automation';
      toast.error(message);
    },
  });
}

