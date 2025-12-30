import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function usePurchasePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ packageId, currency = 'EUR' }) => {
      const res = await billingApi.purchase({ packageId, currency });
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
      const message = error.response?.data?.message || 'Failed to initiate purchase';
      toast.error(message);
    },
  });
}

