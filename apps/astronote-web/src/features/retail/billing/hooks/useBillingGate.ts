import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/src/lib/retail/api/billing';

export function useBillingGate() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: async () => {
      const res = await billingApi.getBalance();
      return res.data;
    },
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });

  const subscription = data?.subscription || { active: false, planType: null };
  const credits = data?.credits || 0;
  const canSendCampaigns = subscription.active === true;

  const reason = canSendCampaigns
    ? null
    : 'Active subscription required to send campaigns. Credits can only be used with an active subscription.';

  const ctaTarget = '/app/retail/billing';

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

