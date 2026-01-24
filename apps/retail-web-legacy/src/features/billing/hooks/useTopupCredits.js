import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

/**
 * Hook for purchasing credit top-ups
 * Ensures credits are valid and handles checkout redirect
 */
export function useTopupCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ credits }) => {
      const creditsValue = Number(credits);
      if (!Number.isInteger(creditsValue) || creditsValue <= 0) {
        throw new Error('Credits must be a positive whole number');
      }

      const res = await billingApi.topup({ credits: creditsValue });
      return res.data;
    },
    onSuccess: (data) => {
      // Invalidate balance query so credits update after return from Stripe
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.balance });
      
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error('No checkout URL received');
        console.error('[Billing] Topup response missing checkoutUrl:', data);
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Failed to initiate credit top-up';
      toast.error(message);
      
      // Log error for debugging (only in dev)
      if (import.meta.env.DEV || localStorage.getItem('DEBUG_BILLING') === 'true') {
        console.error('[Billing] Topup error:', {
          message: error.message,
          response: error.response?.data,
          credits: error.config?.data,
        });
      }
    },
    retry: false, // Don't retry payment mutations
  });
}
