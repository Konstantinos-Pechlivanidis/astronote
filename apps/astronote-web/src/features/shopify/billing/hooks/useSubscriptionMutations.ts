'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  subscriptionsApi,
  type BillingApiError,
  type SubscribeRequest,
  type UpdateSubscriptionRequest,
  type SwitchIntervalRequest,
} from '@/src/lib/shopifyBillingApi';

/**
 * React Query hook for subscribing to a plan
 */
export function useSubscribe() {
  return useMutation({
    mutationFn: async (data: SubscribeRequest) => {
      const response = await subscriptionsApi.subscribe(data);
      return response;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        toast.success('Redirecting to payment...');
        window.location.href = data.checkoutUrl;
      } else {
        toast.error('Failed to get checkout URL. Please try again.');
      }
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const code = apiError?.code || error.response?.data?.code || error.code;
      if (code === 'ALREADY_SUBSCRIBED') {
        toast.error('You already have an active subscription. Please cancel your current subscription first.');
      } else if (code === 'BILLING_PROFILE_INCOMPLETE') {
        const missingFields = error.response?.data?.missingFields || [];
        toast.error('Please complete your billing details before subscribing. You can sync from Stripe or edit manually.', {
          duration: 7000,
        });
        // Redirect to billing settings with missing fields
        setTimeout(() => {
          window.location.href = `/app/shopify/billing?missingFields=${encodeURIComponent(JSON.stringify(missingFields))}`;
        }, 1000);
      } else if (code === 'MISSING_PRICE_ID') {
        toast.error('Payment configuration error. Please contact support.');
      } else if (code === 'INVALID_PLAN_TYPE') {
        toast.error('Invalid subscription plan selected.');
      } else {
        const message = apiError?.message || error.response?.data?.message || 'Failed to initiate subscription';
        toast.error(message);
      }
    },
  });
}

/**
 * React Query hook for updating subscription plan
 */
export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSubscriptionRequest) => {
      const response = await subscriptionsApi.update(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate subscription status and billing summary
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });
      toast.success('Subscription updated successfully');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to update subscription';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for canceling subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await subscriptionsApi.cancel();
    },
    onSuccess: () => {
      // Invalidate subscription status and billing summary
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });
      toast.success('Subscription cancelled successfully');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to cancel subscription';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for getting Stripe Customer Portal URL
 */
export function useGetPortal() {
  return useMutation({
    mutationFn: async () => {
      const response = await subscriptionsApi.getPortal();
      return response;
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank', 'noopener,noreferrer');
        toast.success('Opening customer portal...');
      } else {
        toast.error('Failed to get portal URL. Please try again.');
      }
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const code = apiError?.code || error.response?.data?.code || error.code;
      if (code === 'MISSING_CUSTOMER_ID') {
        toast.error('No payment account found. Please subscribe to a plan first.');
      } else {
        const message = apiError?.message || error.response?.data?.message || 'Failed to open customer portal';
        toast.error(message);
      }
    },
  });
}

/**
 * React Query hook for switching subscription interval
 */
export function useSwitchInterval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SwitchIntervalRequest) => {
      const response = await subscriptionsApi.switchInterval(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate subscription status and billing summary
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });
      toast.success('Subscription interval updated successfully');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to switch subscription interval';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for finalizing subscription from checkout session
 */
export function useFinalizeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { sessionId: string; type?: string }) => {
      const response = await subscriptionsApi.finalize(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate subscription status and billing summary
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'balance'] });
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to finalize subscription';
      toast.error(message);
    },
  });
}
