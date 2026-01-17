import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-background-elevated p-6 text-center">
        <h1 className="text-2xl font-bold text-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

