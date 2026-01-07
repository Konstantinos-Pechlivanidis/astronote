'use client';

import axios from 'axios';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';

type ResolveState = 'idle' | 'loading' | 'redirected' | 'not_found' | 'error';

/**
 * Resolves a shortCode via the backend public resolver and redirects to the original URL.
 * Renders simple public loading/error states while resolving.
 */
export function ShortLinkResolver() {
  const params = useParams();
  const shortCode = (params.shortCode as string | undefined)?.trim();
  const [state, setState] = useState<ResolveState>('idle');
  const baseUrl = useMemo(
    () => (process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),
    [],
  );

  useEffect(() => {
    const resolve = async () => {
      if (!shortCode) {
        setState('error');
        return;
      }
      setState('loading');
      try {
        const res = await axios.get(`${baseUrl}/public/s/${encodeURIComponent(shortCode)}`, {
          maxRedirects: 0,
          validateStatus: (s) => s === 302 || s === 200 || s === 404 || (s >= 200 && s < 400),
        });
        const redirectTarget =
          res.headers?.location ||
          res.data?.originalUrl ||
          res.data?.targetUrl;
        if (res.status === 302 && res.headers?.location) {
          setState('redirected');
          window.location.replace(res.headers.location);
          return;
        }
        if (redirectTarget) {
          setState('redirected');
          window.location.replace(redirectTarget);
        } else {
          setState('error');
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setState('not_found');
        } else {
          setState('error');
        }
      }
    };
    resolve();
  }, [baseUrl, shortCode]);

  if (state === 'loading' || state === 'idle') {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Opening link..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (state === 'redirected') {
    // Safety: render nothing while the browser navigates away
    return null;
  }

  return (
    <PublicLayout>
      <PublicCard>
        <PublicError
          title={state === 'not_found' ? 'Link expired' : 'Link not available'}
          message={
            state === 'not_found'
              ? 'This short link is no longer available. Please contact the store for a fresh link.'
              : 'This short link cannot be resolved right now. Please contact the store for the full link.'
          }
        />
      </PublicCard>
    </PublicLayout>
  );
}
