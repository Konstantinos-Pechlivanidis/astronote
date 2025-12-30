import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';
import { toast } from 'sonner';

export function useUnsubscribe() {
  return useMutation({
    mutationFn: async ({ pageToken, token }: { pageToken: string; token?: string }) => {
      const res = await publicApi.unsubscribe({ pageToken, token });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'You have been unsubscribed successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to unsubscribe. Please try again.';
      toast.error(message);
    },
  });
}

