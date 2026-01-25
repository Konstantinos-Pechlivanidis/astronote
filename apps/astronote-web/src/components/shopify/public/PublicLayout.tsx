import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shopify Public Layout
 * Isolated from Retail public components
 * Used for Shopify public pages (unsubscribe, etc.)
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-theme astro-shell min-h-screen flex flex-col text-text-primary">
      <div className="astro-glow astro-glow--one" aria-hidden="true" />
      <div className="astro-glow astro-glow--two" aria-hidden="true" />
      {/* Header */}
      <header className="bg-black/25 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <span className="text-xl font-bold font-display">Astronote</span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Shopify</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      {/* Footer */}
      <footer className="bg-black/30 border-t border-white/10 py-4 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-text-secondary">
          <p>Need help? Contact the store directly.</p>
        </div>
      </footer>
    </div>
  );
}
