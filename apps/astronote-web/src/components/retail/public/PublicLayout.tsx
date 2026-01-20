import type { ReactNode } from 'react';
import Link from 'next/link';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0d1117] via-[#0a1a26] to-[#060b12] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-[#0ed7c4] text-[#0b1f2e] flex items-center justify-center font-extrabold">
              A
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
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="lg:col-span-1">{children}</div>
            <div className="hidden lg:block">
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/60 mb-3">Astronote Advantage</p>
                <h2 className="text-2xl font-bold text-white mb-4">Modern, reliable messaging for retail</h2>
                <ul className="space-y-3 text-sm text-white/80">
                  <li className="flex gap-3">
                    <span className="h-2 w-2 mt-2 rounded-full bg-[#0ed7c4]" />
                    <span>Secure, tenant-safe links for offers and opt-outs.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-2 w-2 mt-2 rounded-full bg-[#0ed7c4]" />
                    <span>Fast redirects from <strong>astronote.onrender.com</strong> with built-in tracking.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-2 w-2 mt-2 rounded-full bg-[#0ed7c4]" />
                    <span>Polished experiences that convert—on mobile and desktop.</span>
                  </li>
                </ul>
                <div className="mt-6 rounded-xl bg-[#0ed7c4]/10 border border-[#0ed7c4]/30 p-4">
                  <p className="text-sm text-white/80">
                    Need help? Reach us at <Link href="mailto:support@astronote.ai" className="text-[#0ed7c4] underline">support@astronote.ai</Link>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-white/70">
          <div className="space-y-1">
            <p className="font-semibold text-white">Astronote SMS Marketing</p>
            <p>Serving modern retail brands with compliant, high-conversion messaging.</p>
          </div>
          <div className="flex flex-col sm:items-end space-y-1">
            <p><span className="text-white/50">Web:</span> <Link href="https://astronote.onrender.com" className="text-[#0ed7c4] underline">astronote.onrender.com</Link></p>
            <p><span className="text-white/50">Email:</span> <Link href="mailto:support@astronote.ai" className="text-[#0ed7c4] underline">support@astronote.ai</Link></p>
            <p><span className="text-white/50">Phone:</span> +30 210 000 0000</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
