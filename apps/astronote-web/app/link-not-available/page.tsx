export const dynamic = 'force-dynamic';

import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function LinkNotAvailablePage() {
  return (
    <PublicLayout>
      <PublicCard className="space-y-5 text-text-primary">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent-light border border-accent flex items-center justify-center text-accent">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-text-tertiary">Link unavailable</p>
            <h1 className="text-2xl font-bold">This link is no longer available</h1>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          The link may have expired or been replaced. Please contact the store for a fresh link or return to the Astronote home page.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-text-tertiary">
            Safe redirects powered by astronote.onrender.com
          </div>
          <div className="flex gap-2">
            <Link
              href="https://astronote.onrender.com"
              className="px-4 py-2 text-sm rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
            >
              Go to homepage
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-sm rounded-lg bg-accent text-[#041b1f] hover:bg-accent-hover transition font-semibold"
            >
              Learn more
            </Link>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
