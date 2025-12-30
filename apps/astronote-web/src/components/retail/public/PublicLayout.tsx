import type { ReactNode } from 'react';
import Link from 'next/link';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background-elevated flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="text-xl font-bold text-text-primary">
            Astronote
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border py-4">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-text-secondary">
          <p>Need help? Contact the store directly.</p>
        </div>
      </footer>
    </div>
  );
}

