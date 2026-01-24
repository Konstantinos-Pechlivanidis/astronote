import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';

/**
 * Billing gate hook - provides subscription status and gating logic
 * Used across the app to determine if user can send campaigns
 * 
 * Returns normalized data: { credits: number, subscription: {...} }
 */
export function useBillingGate() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.billing.balance,
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data; // Already normalized by billingApi
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });

  const subscription = data?.subscription || { active: false, planType: null };
  const credits = data?.credits || 0; // Fixed: use normalized credits field
  const canSendCampaigns = subscription.active === true;

  const reason = canSendCampaigns
    ? null
    : 'Credits accumulate and never expire; spending requires an active subscription.';

  const ctaTarget = '/app/billing';

  return {
    credits,
    subscription,
    canSendCampaigns,
    reason,
    ctaTarget,
    isLoading,
    error,
  };
}
