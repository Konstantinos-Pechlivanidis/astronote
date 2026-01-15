import { redirect } from 'next/navigation';
import { SHOPIFY_API_BASE_URL } from '@/src/lib/shopify/config';

/**
 * Public short-link redirect endpoint on the web domain.
 *
 * We forward to the Shopify API `/r/:token` handler, which:
 * - rate limits
 * - validates destination URL allowlist (if configured)
 * - increments click counts
 * - redirects to the final destination
 *
 * This keeps SMS links on the main web domain (e.g. https://astronote.onrender.com/r/<token>).
 */
export default function ShortLinkRedirectPage({ params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) {
    redirect('/error?message=Invalid%20link');
  }
  redirect(`${SHOPIFY_API_BASE_URL.replace(/\/+$/, '')}/r/${encodeURIComponent(token)}`);
}


