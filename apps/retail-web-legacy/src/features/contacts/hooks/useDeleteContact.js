import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await contactsApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'list'] });
      queryClient.removeQueries({ queryKey: queryKeys.contacts.detail(id) });
      toast.success('Contact deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete contact';
      toast.error(message);
    },
  });
}

