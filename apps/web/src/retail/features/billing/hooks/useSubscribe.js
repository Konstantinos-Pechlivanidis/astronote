import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../../../api/modules/subscriptions';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planType }) => {
      const res = await subscriptionsApi.subscribe({ planType });
      return res.data;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error('No checkout URL received');
      }
    },
    onError: (error) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to initiate subscription';

      if (code === 'ALREADY_SUBSCRIBED') {
        toast.error('You already have an active subscription');
      } else {
        toast.error(message);
      }
    },
  });
}

