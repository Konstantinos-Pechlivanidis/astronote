import { useMutation } from '@tanstack/react-query';
import { campaignsApi } from '../../../api/modules/campaigns';
import { toast } from 'sonner';

export function usePreviewAudience() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await campaignsApi.previewAudience(data);
      return res.data;
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to preview audience';
      toast.error(message);
    },
    retry: false,
  });
}

