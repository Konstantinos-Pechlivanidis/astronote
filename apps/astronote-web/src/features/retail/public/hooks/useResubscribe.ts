import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';
import { toast } from 'sonner';

export function useResubscribe() {
  return useMutation({
    mutationFn: async ({ pageToken }: { pageToken: string }) => {
      const res = await publicApi.resubscribe({ pageToken });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'You have been resubscribed successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to resubscribe. Please try again.';
      toast.error(message);
    },
  });
}

