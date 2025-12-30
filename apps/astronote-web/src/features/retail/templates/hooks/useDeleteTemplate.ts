import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/retail/api/templates';
import { toast } from 'sonner';

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await templatesApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'templates', 'list'] });
      queryClient.removeQueries({ queryKey: ['retail', 'templates', 'detail', id] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to delete template';
      toast.error(message);
    },
  });
}

