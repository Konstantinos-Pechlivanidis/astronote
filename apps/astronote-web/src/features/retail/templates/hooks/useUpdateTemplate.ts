import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi, type Template } from '@/src/lib/retail/api/templates';
import { toast } from 'sonner';

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Template> }) => {
      const res = await templatesApi.update(id, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'templates', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'templates', 'detail', variables.id] });
      toast.success('Template updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update template';
      toast.error(message);
    },
  });
}

