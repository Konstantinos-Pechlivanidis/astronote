import { NextRequest, NextResponse } from 'next/server';

const RETAIL_API_BASE = process.env.RETAIL_API_BASE_URL || 'https://astronote-retail.onrender.com';

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
