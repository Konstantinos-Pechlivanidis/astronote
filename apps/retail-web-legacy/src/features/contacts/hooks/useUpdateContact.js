import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await contactsApi.update(id, data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.detail(variables.id) });
      toast.success('Contact updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update contact';
      toast.error(message);
    },
  });
}

