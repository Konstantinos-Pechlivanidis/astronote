'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  billingApi,
  type BillingApiError,
  type CreatePurchaseRequest,
  type CreateTopupRequest,
} from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for creating a purchase (credit packs)
 */
export function useCreatePurchase() {
  return useMutation({
    mutationFn: async (data: CreatePurchaseRequest) => {
      const response = await billingApi.createPurchase(data);
      return response;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      const checkoutUrl = data.checkoutUrl || data.sessionUrl;
      if (checkoutUrl) {
        toast.success('Redirecting to payment...');
        window.location.href = checkoutUrl;
      } else {
        toast.error('Failed to get checkout URL. Please try again.');
      }
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const code = apiError?.code || error.response?.data?.code || error.code;
      if (code === 'SUBSCRIPTION_REQUIRED' || code === 'INACTIVE_SUBSCRIPTION') {
        toast.error('An active subscription is required to purchase credit packs.');
      } else {
        const message = apiError?.message || error.response?.data?.message || 'Failed to initiate purchase';
        toast.error(message);
      }
    },
  });
}

/**
 * React Query hook for creating a top-up checkout session
 */
export function useCreateTopup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTopupRequest) => {
      const response = await billingApi.createTopup(data);
      return response;
    },
    onSuccess: (data) => {
      // Invalidate billing surfaces that reflect credits / money
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.balance() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.invoicesRoot() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.historyRoot() });

      // Redirect to Stripe checkout
      const checkoutUrl = data.checkoutUrl || data.sessionUrl;
      if (checkoutUrl) {
        toast.success('Redirecting to payment...');
        window.location.href = checkoutUrl;
      } else {
        toast.error('Failed to get checkout URL. Please try again.');
      }
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const message = apiError?.message || error.response?.data?.message || 'Failed to initiate top-up';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for syncing billing profile from Stripe
 */
export function useSyncBillingProfileFromStripe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await billingApi.syncProfileFromStripe();
      return response;
    },
    onSuccess: () => {
      // Invalidate billing profile and summary
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.profile() });
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.billing.summary() });
      toast.success('Billing profile synced from Stripe');
    },
    onError: (error: any) => {
      const apiError = error as BillingApiError;
      const code = apiError?.code || error.response?.data?.code || error.code;
      if (code === 'MISSING_CUSTOMER_ID') {
        toast.error('No Stripe customer found. Please subscribe to a plan first.');
      } else {
        const message = apiError?.message || error.response?.data?.message || 'Failed to sync billing profile from Stripe';
        toast.error(message);
      }
    },
  });
}
