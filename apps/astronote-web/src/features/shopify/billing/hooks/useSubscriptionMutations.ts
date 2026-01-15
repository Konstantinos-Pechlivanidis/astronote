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
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

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
        // PHASE 3.5: This error should no longer occur (billing details collected in checkout)
        // But if it does (e.g., config error), show a helpful message
        toast.error('Payment configuration error. Billing details should be collected during checkout. Please contact support if this persists.');
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
    onSuccess: (data: any) => {
      // If backend requires "checkout" flow, redirect (Stripe portal acts as the checkout flow).
      if (data?.checkoutUrl) {
        toast.success('Redirecting to Stripe to complete the change...');
        window.location.href = data.checkoutUrl;
        return;
      }

      // Invalidate subscription status and billing summary
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.invoicesRoot() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.historyRoot() });
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
      // Invalidate queries to refresh UI with updated status
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      toast.success('Subscription will cancel at the end of the current billing period. You will retain access until then.');
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
    onSuccess: (data) => {
      if ((data as any)?.checkoutUrl) {
        toast.success('Redirecting to Stripe to complete the change...');
        window.location.href = (data as any).checkoutUrl;
        return;
      }

      // Invalidate subscription status and billing summary to refresh UI
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.invoicesRoot() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.historyRoot() });

      // Show appropriate message based on whether change is immediate or scheduled
      if (data.scheduled && data.effectiveAt) {
        const effectiveDate = new Date(data.effectiveAt).toLocaleDateString();
        toast.success(`Subscription will switch to ${data.interval === 'year' ? 'yearly' : 'monthly'} billing on ${effectiveDate}`);
      } else {
        toast.success('Subscription interval updated successfully');
      }
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to switch subscription interval';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for reconciling subscription with Stripe
 */
export function useReconcileSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await subscriptionsApi.reconcile();
      return response;
    },
    onSuccess: () => {
      // Invalidate all subscription-related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.invoicesRoot() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.historyRoot() });
      toast.success('Subscription status refreshed from Stripe');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to reconcile subscription';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for changing a scheduled subscription change
 */
export function useChangeScheduledSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSubscriptionRequest) => {
      const response = await subscriptionsApi.changeScheduledSubscription(data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      toast.success('Scheduled change updated');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to update scheduled change';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for cancelling a scheduled subscription change
 */
export function useCancelScheduledSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await subscriptionsApi.cancelScheduledSubscription();
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      toast.success('Scheduled change cancelled');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to cancel scheduled change';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for resuming subscription (undo cancellation)
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await subscriptionsApi.resume();
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh UI with updated status
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      toast.success('Subscription resumed successfully');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to resume subscription';
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
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.subscriptions.status() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.invoicesRoot() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.historyRoot() });
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to finalize subscription';
      toast.error(message);
    },
  });
}
