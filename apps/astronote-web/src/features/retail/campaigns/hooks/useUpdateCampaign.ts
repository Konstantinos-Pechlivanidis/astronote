import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignsApi, type Campaign } from '@/src/lib/retail/api/campaigns';
import { toast } from 'sonner';

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Campaign> }) => {
      const res = await campaignsApi.update(id, data);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns', 'detail', variables.id] });
      toast.success('Campaign updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update campaign';
      toast.error(message);
    },
  });
}

