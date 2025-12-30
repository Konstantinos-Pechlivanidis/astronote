import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { campaignsApi, type CampaignCreateRequest } from '@/src/lib/retail/api/campaigns';
import { toast } from 'sonner';

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CampaignCreateRequest) => {
      const res = await campaignsApi.create(data);
      return res.data;
    },
    retry: false, // Prevent duplicate submissions
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'list'] });
      toast.success('Campaign created successfully');
      const campaignId = data.campaign?.id || data.id;
      if (campaignId) {
        router.push(`/app/retail/campaigns/${campaignId}`);
      } else {
        router.push('/app/retail/campaigns');
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create campaign';
      toast.error(message);
    },
  });
}

