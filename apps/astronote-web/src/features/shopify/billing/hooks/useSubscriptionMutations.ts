'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  subscriptionsApi,
  type SubscribeRequest,
  type UpdateSubscriptionRequest,
} from '@/src/lib/shopify/api/billing';

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
      if (error.response?.data?.code === 'ALREADY_SUBSCRIBED' || error.code === 'ALREADY_SUBSCRIBED') {
        toast.error('You already have an active subscription. Please cancel your current subscription first.');
      } else if (error.response?.data?.code === 'MISSING_PRICE_ID' || error.code === 'MISSING_PRICE_ID') {
        toast.error('Payment configuration error. Please contact support.');
      } else if (error.response?.data?.code === 'INVALID_PLAN_TYPE' || error.code === 'INVALID_PLAN_TYPE') {
        toast.error('Invalid subscription plan selected.');
      } else {
        const message = error.response?.data?.message || 'Failed to initiate subscription';
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
      // Invalidate subscription status
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });
      toast.success('Subscription updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update subscription';
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
      // Invalidate subscription status
      queryClient.invalidateQueries({ queryKey: ['shopify', 'subscriptions', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });
      toast.success('Subscription cancelled successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to cancel subscription';
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
      if (error.response?.data?.code === 'MISSING_CUSTOMER_ID' || error.code === 'MISSING_CUSTOMER_ID') {
        toast.error('No payment account found. Please subscribe to a plan first.');
      } else {
        const message = error.response?.data?.message || 'Failed to open customer portal';
        toast.error(message);
      }
    },
  });
}

