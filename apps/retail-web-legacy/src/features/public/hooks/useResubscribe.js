import { useMutation } from '@tanstack/react-query';
import { publicContactsApi } from '../../../api/modules/publicContacts';
import { toast } from 'sonner';

export function useResubscribe() {
  return useMutation({
    mutationFn: async ({ pageToken }) => {
      const res = await publicContactsApi.resubscribe({ pageToken });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'You have been resubscribed successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to resubscribe. Please try again.';
      toast.error(message);
    },
  });
}

