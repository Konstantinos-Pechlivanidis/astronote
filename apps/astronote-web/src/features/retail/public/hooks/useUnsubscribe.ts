import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';
import { toast } from 'sonner';

export function useUnsubscribe() {
  return useMutation({
    mutationFn: async ({ pageToken, token }: { pageToken: string; token?: string }) => {
      // Send both pageToken and token (duplicate) to survive proxies/servers that only look for one key.
      const payload = { pageToken, token: token || pageToken };
      const res = await publicApi.unsubscribe(payload);
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
