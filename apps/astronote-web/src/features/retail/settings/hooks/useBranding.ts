import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';

export interface BrandingPayload {
  storeName: string;
  storeDisplayName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundStyle?: string;
  headline?: string;
  subheadline?: string;
  benefits?: string[];
  incentiveText?: string;
  legalText?: string;
  privacyUrl?: string;
  termsUrl?: string;
}

export function useBranding() {
  return useQuery({
    queryKey: ['retail', 'branding'],
    queryFn: async () => {
      const res = await apiClient.get(endpoints.branding);
      return res.data as BrandingPayload;
    },
  });
}

export function useSaveBranding() {
  return useMutation({
    mutationFn: async (payload: BrandingPayload) => {
      const res = await apiClient.put(endpoints.branding, payload);
      return res.data;
    },
  });
}
