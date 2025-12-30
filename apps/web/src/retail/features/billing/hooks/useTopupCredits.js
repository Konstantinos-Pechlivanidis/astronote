import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

/**
 * Hook for purchasing credit packs
 * Ensures packId is string and handles checkout redirect
 */
export function useTopupCredits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ packId }) => {
      // billingApi.topup already normalizes packId to string, but defensive check here
      const packIdString = String(packId);
      if (!packIdString || !packIdString.startsWith('pack_')) {
        throw new Error(`Invalid pack ID format: ${packId}. Expected format: 'pack_100', 'pack_500', etc.`);
      }

      const res = await billingApi.topup({ packId: packIdString });
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
          packId: error.config?.data,
        });
      }
    },
    retry: false, // Don't retry payment mutations
  });
}

