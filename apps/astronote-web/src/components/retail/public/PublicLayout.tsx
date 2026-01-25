'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function PublicLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.classList.remove('retail-light');
    root.classList.add('public-theme');
    return () => {
      root.classList.remove('public-theme');
    };
  }, []);

  return (
    <div className="public-theme marketing-theme astro-shell min-h-screen flex flex-col text-text-primary">
      <div className="astro-glow astro-glow--one" aria-hidden="true" />
      <div className="astro-glow astro-glow--two" aria-hidden="true" />
      <header className="border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-white/90 overflow-hidden border border-white/20 shadow-sm">
              <Image
                src="/logo/astronote-logo-1200x1200.png"
                alt="Astronote logo"
                width={44}
                height={44}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight font-display">Astronote</p>
              <p className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Retail messaging</p>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-3 text-xs text-text-tertiary uppercase tracking-[0.2em]">
            <span className="h-2 w-2 rounded-full bg-[#12C6B5] shadow-[0_0_12px_rgba(18,198,181,0.7)]" />
            <span>Member-first journeys</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl">{children}</div>
      </main>

      <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-text-tertiary uppercase tracking-[0.24em]">
            Powered by Astronote
          </p>
          <Link
            href="https://astronote.onrender.com"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 transition"
          >
            Visit Astronote
          </Link>
        </div>
      </footer>
    </div>
  );
}
