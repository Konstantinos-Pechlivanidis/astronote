import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { JoinPageV2Client } from './JoinPageV2Client';

const API_BASE = process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001';
const LANDING_PAGE_URL = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'https://astronote.app';

type JoinInfoResponse = {
  ok: boolean
  branding: {
    storeName?: string
    storeDisplayName?: string
    logoUrl?: string | null
    headline?: string
    subheadline?: string
    pageDescription?: string
  }
};

async function fetchJoinInfo(token: string): Promise<JoinInfoResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/public/join/${token}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<JoinInfoResponse>;
  } catch {
    return null;
  }
}

function canonicalBase() {
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  if (host) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || LANDING_PAGE_URL).replace(/\/$/, '');
}

export async function generateMetadata({
  params,
}: {
  params: { token: string }
}): Promise<Metadata> {
  const token = typeof params?.token === 'string' ? params.token : '';
  const base = canonicalBase();
  const data = token ? await fetchJoinInfo(token) : null;

  const title = 'Subscribe to get member benefits';
  const description = 'Get offers, updates, and member-only perks from this store.';
  const storeName = data?.branding?.storeDisplayName || data?.branding?.storeName || 'Store';

  return {
    title: `${title} – ${storeName}`,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/join/${token}`,
      siteName: storeName,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function JoinTokenPage({ params }: { params: { token: string } }) {
  const token = typeof params?.token === 'string' ? params.token : '';
  return <JoinPageV2Client token={token} />;
}
