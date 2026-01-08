import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';

function buildCanonicalJoinUrl(token?: string, fallbackUrl?: string) {
  if (!token) return fallbackUrl || '';
  let origin = '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    origin = window.location.origin;
  } else if (fallbackUrl) {
    try {
      origin = new URL(fallbackUrl).origin;
    } catch {
      origin = '';
    }
  }
  return origin ? `${origin}/join/${token}` : `/join/${token}`;
}

export function usePublicLinks() {
  return useQuery({
    queryKey: ['retail', 'public-links'],
    queryFn: async () => {
      const res = await apiClient.get(endpoints.publicLinks.me);
      const data = res.data as { ok: boolean; token: string; joinUrl: string; qrValue: string };
      return {
        ...data,
        canonicalJoinUrl: buildCanonicalJoinUrl(data.token, data.joinUrl),
      };
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
