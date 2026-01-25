'use client';

import type { ReactNode } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="marketing-theme astro-shell flex min-h-screen flex-col">
      <div className="astro-glow astro-glow--one" aria-hidden="true" />
      <div className="astro-glow astro-glow--two" aria-hidden="true" />
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
