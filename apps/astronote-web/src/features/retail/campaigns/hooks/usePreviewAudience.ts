import { useMutation } from '@tanstack/react-query';
import { campaignsApi, type AudiencePreviewRequest } from '@/src/lib/retail/api/campaigns';
import { toast } from 'sonner';

export function usePreviewAudience() {
  return useMutation({
    mutationFn: async (data: AudiencePreviewRequest) => {
      const res = await campaignsApi.previewAudience(data);
      return res.data;
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to preview audience';
      toast.error(message);
    },
    retry: false,
  });
}

