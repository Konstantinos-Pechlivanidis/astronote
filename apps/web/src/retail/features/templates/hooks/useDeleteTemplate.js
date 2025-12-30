import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await templatesApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      // Invalidate templates list queries
      queryClient.invalidateQueries({ queryKey: ['templates', 'list'] });
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete template';
      const code = error.response?.data?.code;

      if (code === 'RESOURCE_NOT_FOUND') {
        toast.error('Template not found or you do not have permission to delete it');
      } else {
        toast.error(message);
      }
    },
  });
}

