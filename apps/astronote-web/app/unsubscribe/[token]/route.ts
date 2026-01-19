import { NextRequest, NextResponse } from 'next/server';

function sanitizeBase(raw?: string | null) {
  const base = (raw || 'https://astronote-retail.onrender.com').trim().replace(/\/+$/, '');
  if (base.toLowerCase().endsWith('/api')) {
    console.warn('[unsubscribe-proxy] RETAIL_API_BASE_URL contained /api; stripping for public unsubscribe');
    return base.slice(0, -4);
  }
  return base;
}

const RETAIL_API_BASE = sanitizeBase(process.env.RETAIL_API_BASE_URL);

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) {
    return NextResponse.redirect('https://astronote.onrender.com', 302);
  }

  try {
    const res = await fetch(`${RETAIL_API_BASE}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      const redirect = new URL('/unsubscribed', 'https://astronote.onrender.com');
      return NextResponse.redirect(redirect.toString(), 302);
    }

    // If backend returns non-200, show link not available fallback
    const fallback = new URL('/link-not-available', 'https://astronote.onrender.com');
    fallback.searchParams.set('type', 's');
    fallback.searchParams.set('token', token);
    return NextResponse.redirect(fallback.toString(), 302);
  } catch (_err) {
    const fallback = new URL('/link-not-available', 'https://astronote.onrender.com');
    fallback.searchParams.set('type', 's');
    fallback.searchParams.set('token', token);
    return NextResponse.redirect(fallback.toString(), 302);
  }
}
