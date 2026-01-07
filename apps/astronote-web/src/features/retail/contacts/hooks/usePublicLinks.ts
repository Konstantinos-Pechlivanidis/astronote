import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';

export function usePublicLinks() {
  return useQuery({
    queryKey: ['retail', 'public-links'],
    queryFn: async () => {
      const res = await apiClient.get(endpoints.publicLinks.me);
      return res.data as { ok: boolean; token: string; joinUrl: string; qrValue: string };
    },
  });
}

export function useRotatePublicLinks() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(endpoints.publicLinks.rotate);
      return res.data as { ok: boolean; token: string; joinUrl: string; qrValue: string };
    },
  });
}
