import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data) => {
      const res = await campaignsApi.create(data);
      return res.data;
    },
    // P0 FIX: Explicitly disable retry to prevent duplicate submissions
    retry: false,
    onSuccess: (data) => {
      // Invalidate campaigns list query to refresh the list
      // Use partial match to invalidate all list queries regardless of params
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      toast.success('Campaign created successfully');
      // Navigate to campaign detail page
      // Backend returns { campaign: { id, ... } } or { id, ... }
      const campaignId = data.campaign?.id || data.id;
      if (campaignId) {
        navigate(`/app/campaigns/${campaignId}`);
      } else {
        // Fallback: navigate to campaigns list if ID is missing
        navigate('/app/campaigns');
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to create campaign';
      toast.error(message);
    },
  });
}

