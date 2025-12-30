import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const res = await templatesApi.create(data);
      return res.data;
    },
    onSuccess: (data) => {
      // Invalidate templates list queries
      queryClient.invalidateQueries({ queryKey: ['templates', 'list'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create template';
      const code = error.response?.data?.code;
      
      if (code === 'DUPLICATE_RESOURCE') {
        toast.error('A template with this name already exists');
      } else if (code === 'VALIDATION_ERROR') {
        toast.error(message);
      } else {
        toast.error(message);
      }
    },
  });
}

