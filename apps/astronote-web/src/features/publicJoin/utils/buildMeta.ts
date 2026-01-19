import type { Metadata } from 'next';

const API_BASE = (process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '').replace(/\/api$/i, '');
const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'https://astronote.app';
const DEFAULT_OG_IMAGE = process.env.NEXT_PUBLIC_JOIN_OG_URL || `${LANDING_PAGE_URL}/og.png`;

type JoinBrandingMeta = {
  storeName?: string | null
  storeDisplayName?: string | null
  logoUrl?: string | null
  ogImageUrl?: string | null
  pageTitle?: string | null
  pageDescription?: string | null
  subheadline?: string | null
};

function normalizeOgUrl(url?: string | null) {
  if (!url) return DEFAULT_OG_IMAGE;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function buildMeta({
  baseUrl,
  token,
  branding,
}: {
  baseUrl: string
  token: string
  branding?: JoinBrandingMeta | null
}): Metadata {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const title =
    branding?.pageTitle ||
    branding?.storeDisplayName ||
    branding?.storeName ||
    'Join the store';
  const description =
    branding?.pageDescription ||
    branding?.subheadline ||
    'Join to receive exclusive offers and updates.';
  const ogImage = normalizeOgUrl(branding?.ogImageUrl || branding?.logoUrl);
  const canonicalUrl = `${cleanBase}/join/${token}`;

  return {
    title,
    description,
    metadataBase: new URL(cleanBase),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}
