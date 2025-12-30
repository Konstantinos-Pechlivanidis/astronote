import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, type Contact } from '@/src/lib/retail/api/contacts';
import { toast } from 'sonner';

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const res = await contactsApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'contacts', 'list'] });
      toast.success('Contact created successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to create contact';
      toast.error(message);
    },
  });
}

