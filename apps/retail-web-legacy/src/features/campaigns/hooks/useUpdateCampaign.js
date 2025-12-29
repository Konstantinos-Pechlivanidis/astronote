import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await campaignsApi.update(id, data);
      return res.data;
    },
    // P0 FIX: Explicitly disable retry to prevent duplicate submissions
    retry: false,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(variables.id) });
      toast.success('Campaign updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update campaign';
      toast.error(message);
    },
  });
}

