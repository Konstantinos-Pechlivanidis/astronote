import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';

export function useNfcLink() {
  return useQuery({
    queryKey: ['retail', 'settings', 'nfc'],
    queryFn: async () => {
      const res = await apiClient.get(endpoints.nfc.me);
      return res.data as { ok: boolean; token: string; nfcUrl: string; label?: string };
    },
  });
}

export function useRotateNfcLink() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(endpoints.nfc.rotate);
      return res.data as { ok: boolean; token: string; nfcUrl: string };
    },
  });
}
