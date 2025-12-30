import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, type Contact } from '@/src/lib/retail/api/contacts';
import { toast } from 'sonner';

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Contact> }) => {
      const res = await contactsApi.update(id, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'contacts', 'detail', variables.id] });
      toast.success('Contact updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update contact';
      toast.error(message);
    },
  });
}

