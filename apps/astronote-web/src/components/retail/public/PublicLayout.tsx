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
    <div className="public-theme min-h-screen flex flex-col bg-gradient-to-br from-[#0d1117] via-[#0a1a26] to-[#060b12] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-white/90 overflow-hidden border border-white/10 shadow-sm">
              <Image
                src="/logo/astronote-logo-1200x1200.png"
                alt="Astronote logo"
                width={40}
                height={40}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">Astronote</p>
              <p className="text-xs text-white/70">SMS Marketing Platform</p>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-3 text-sm text-white/70">
            <span className="h-2 w-2 rounded-full bg-[#0ed7c4]" />
            <span>Trusted delivery, customer-first design.</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl">{children}</div>
      </main>

      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-center">
          <Link
            href="https://astronote.onrender.com"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            Provided by Astronote
          </Link>
        </div>
      </footer>
    </div>
  );
}
