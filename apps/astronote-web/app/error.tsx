'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global app error:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-background-elevated p-6 text-center">
            <h1 className="text-2xl font-bold text-text-primary">Something went wrong</h1>
            <p className="mt-2 text-sm text-text-secondary">
              {error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-text-primary"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

