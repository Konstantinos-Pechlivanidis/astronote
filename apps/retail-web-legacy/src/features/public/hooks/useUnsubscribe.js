import { useMutation } from '@tanstack/react-query';
import { publicContactsApi } from '../../../api/modules/publicContacts';
import { toast } from 'sonner';

export function useUnsubscribe() {
  return useMutation({
    mutationFn: async ({ pageToken, token }) => {
      const res = await publicContactsApi.unsubscribe({ pageToken, token });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'You have been unsubscribed successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to unsubscribe. Please try again.';
      toast.error(message);
    },
  });
}

