import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/src/lib/retail/api/contacts';
import { toast } from 'sonner';

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await contactsApi.delete(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'contacts', 'list'] });
      queryClient.removeQueries({ queryKey: ['retail', 'contacts', 'detail', id] });
      toast.success('Contact deleted successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to delete contact';
      toast.error(message);
    },
  });
}

