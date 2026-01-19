import { NextRequest, NextResponse } from 'next/server';

const RETAIL_API_BASE = process.env.RETAIL_API_BASE_URL || 'https://astronote-retail.onrender.com';

type Attempt = { service: 'retail'; url: string; status?: number; location?: string | null; bodySnippet?: string | null };

async function resolveRedirect(token: string, base: string, path: 'o' | 's', service: Attempt['service']): Promise<{ location: string | null; attempt: Attempt }> {
  const attempt: Attempt = { service, url: `${base}/public/${path}/${encodeURIComponent(token)}` };
  try {
    const res = await fetch(attempt.url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'astronote-shortlink-resolver' },
    });
    attempt.status = res.status;
    attempt.location = res.headers.get('location');
    if (!attempt.location) {
      const text = await res.text();
      attempt.bodySnippet = text.slice(0, 200);
    }
    if (res.status >= 300 && res.status < 400 && attempt.location) {
      return { location: attempt.location, attempt };
    }
    return { location: null, attempt };
  } catch (err) {
    attempt.bodySnippet = (err as Error)?.message || 'fetch_error';
    return { location: null, attempt };
  }
}

export async function GET(req: NextRequest, { params }: { params: { shortCode: string } }) {
  const token = params?.shortCode;
  if (!token) return NextResponse.redirect('https://astronote.onrender.com', 302);
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  const attempts: Attempt[] = [];

  const retail = await resolveRedirect(token, RETAIL_API_BASE, 's', 'retail');
  attempts.push(retail.attempt);
  if (retail.location && !debug) return NextResponse.redirect(retail.location, 302);
  if (retail.location && debug) {
    return NextResponse.json({ type: 's', token, attempts, final: 'redirected', location: retail.location }, { status: 200 });
  }

  if (debug) {
    return NextResponse.json({ type: 's', token, attempts, final: 'not_found' }, { status: 404 });
  }

  const fallback = new URL('/link-not-available', 'https://astronote.onrender.com');
  fallback.searchParams.set('type', 's');
  fallback.searchParams.set('token', token);
  return NextResponse.redirect(fallback.toString(), 302);
}
