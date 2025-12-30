import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../../../api/modules/subscriptions';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

/**
 * Hook for accessing Stripe customer portal
 * Invalidates billing queries after portal return to ensure fresh data
 */
export function useCustomerPortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await subscriptionsApi.getPortal();
      return res.data;
    },
    onSuccess: (data) => {
      // Invalidate billing queries so data refreshes when user returns from portal
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.balance });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.packages });
      
      // Redirect to Stripe customer portal
      if (data.portalUrl) {
        window.location.assign(data.portalUrl);
      } else {
        toast.error('No portal URL received from server');
        console.error('[Billing] Portal response missing portalUrl:', data);
      }
    },
    onError: (error) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to load customer portal';
      
      if (code === 'MISSING_CUSTOMER_ID') {
        toast.error('No payment account found. Please subscribe to a plan first.');
      } else if (code === 'DEV_ONLY_CUSTOMER') {
        toast.error('Customer portal is not available for development test accounts. Please use a real Stripe subscription.');
      } else if (code === 'STRIPE_CUSTOMER_NOT_FOUND') {
        toast.error('Payment account not found. Please contact support or subscribe to a new plan.');
      } else if (code === 'STRIPE_NOT_CONFIGURED') {
        toast.error('Payment processing is currently unavailable. Please try again later.');
      } else if (code === 'STRIPE_ERROR') {
        toast.error(message);
      } else {
        toast.error(message);
      }
      
      // Log error for debugging (only in dev)
      if (import.meta.env.DEV || localStorage.getItem('DEBUG_BILLING') === 'true') {
        console.error('[Billing] Portal error:', {
          message: error.message,
          response: error.response?.data,
          code,
        });
      }
    },
    retry: false, // Don't retry payment mutations
  });
}

