import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const res = await contactsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list'] });
      toast.success('Contact created successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create contact';
      toast.error(message);
    },
  });
}

