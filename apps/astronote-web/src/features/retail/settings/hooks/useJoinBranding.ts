import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';

export type JoinBrandingPayload = {
  storeDisplayName?: string | null;
  logoUrl?: string | null;
  ogImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
  marketingHeadline?: string | null;
  marketingBullets?: string[] | null;
  merchantBlurb?: string | null;
  headlineEn?: string | null;
  headlineEl?: string | null;
  subheadlineEn?: string | null;
  subheadlineEl?: string | null;
  bulletsEn?: string[] | null;
  bulletsEl?: string[] | null;
  merchantBlurbEn?: string | null;
  merchantBlurbEl?: string | null;
  pageTitle?: string | null;
  pageDescription?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  rotateEnabled?: boolean;
  showPoweredBy?: boolean;
};

export type JoinBrandingResponse = {
  ok: boolean;
  branding: {
    storeName: string;
    storeDisplayName: string;
    logoUrl?: string | null;
    ogImageUrl?: string | null;
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    accentColor: string;
    marketingHeadline?: string | null;
    marketingBullets?: string[] | null;
    merchantBlurb?: string | null;
    headlineEn?: string | null;
    headlineEl?: string | null;
    subheadlineEn?: string | null;
    subheadlineEl?: string | null;
    bulletsEn?: string[] | null;
    bulletsEl?: string[] | null;
    merchantBlurbEn?: string | null;
    merchantBlurbEl?: string | null;
    pageTitle?: string | null;
    pageDescription?: string | null;
    websiteUrl?: string | null;
    facebookUrl?: string | null;
    instagramUrl?: string | null;
    rotateEnabled: boolean;
    showPoweredBy: boolean;
  };
};

export function useJoinBranding() {
  return useQuery({
    queryKey: ['retail', 'join-branding'],
    queryFn: async () => {
      const res = await apiClient.get<JoinBrandingResponse>(endpoints.joinBranding);
      return res.data;
    },
  });
}

export function useSaveJoinBranding() {
  return useMutation({
    mutationFn: async (payload: JoinBrandingPayload) => {
      const res = await apiClient.put<JoinBrandingResponse>(endpoints.joinBranding, payload);
      return res.data;
    },
  });
}

export function useUploadJoinLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<JoinBrandingResponse>(`${endpoints.joinBranding}/logo`, form);
      return res.data;
    },
  });
}

export function useUploadJoinOgImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<JoinBrandingResponse>(`${endpoints.joinBranding}/og-image`, form);
      return res.data;
    },
  });
}

export function useDeleteJoinLogo() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<JoinBrandingResponse>(`${endpoints.joinBranding}/logo`);
      return res.data;
    },
  });
}

export function useDeleteJoinOgImage() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<JoinBrandingResponse>(`${endpoints.joinBranding}/og-image`);
      return res.data;
    },
  });
}
