import { NextRequest, NextResponse } from 'next/server';

const RETAIL_API_BASE = process.env.RETAIL_API_BASE_URL || 'https://astronote-retail.onrender.com';
const SHOPIFY_API_BASE = process.env.SHOPIFY_API_BASE_URL || 'https://astronote-shopify.onrender.com';

async function resolveRedirect(token: string, base: string, path: 'o' | 's') {
  try {
    const res = await fetch(`${base}/api/public/${path}/${encodeURIComponent(token)}`, {
      redirect: 'manual',
      headers: { 'User-Agent': 'astronote-shortlink-resolver' },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) return location;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, { params }: { params: { trackingId: string } }) {
  const token = params?.trackingId;
  if (!token) return NextResponse.redirect('https://astronote.onrender.com', 302);

  const retail = await resolveRedirect(token, RETAIL_API_BASE, 'o');
  if (retail) return NextResponse.redirect(retail, 302);

  const shopify = await resolveRedirect(token, SHOPIFY_API_BASE, 'o');
  if (shopify) return NextResponse.redirect(shopify, 302);

  return new NextResponse(
    'Ο σύνδεσμος δεν είναι διαθέσιμος. Go back to astronote.onrender.com.',
    { status: 404, headers: { 'Content-Type': 'text/plain' } },
  );
}
