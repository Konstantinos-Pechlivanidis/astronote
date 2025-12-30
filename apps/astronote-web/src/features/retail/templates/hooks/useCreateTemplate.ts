import { useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi, type Template } from '@/src/lib/retail/api/templates';
import { toast } from 'sonner';

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Template>) => {
      const res = await templatesApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'templates', 'list'] });
      toast.success('Template created successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to create template';
      toast.error(message);
    },
  });
}

