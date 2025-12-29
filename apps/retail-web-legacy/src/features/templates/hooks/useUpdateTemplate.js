import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await templatesApi.update(id, data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate templates list and detail queries
      queryClient.invalidateQueries({ queryKey: ['templates', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.detail(variables.id) });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update template';
      const code = error.response?.data?.code;
      
      if (code === 'RESOURCE_NOT_FOUND') {
        toast.error('Template not found or you do not have permission to update it');
      } else if (code === 'VALIDATION_ERROR') {
        toast.error(message);
      } else {
        toast.error(message);
      }
    },
  });
}

