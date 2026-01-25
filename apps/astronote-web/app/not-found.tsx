import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="marketing-theme astro-shell min-h-screen flex flex-col text-text-primary">
      <div className="astro-glow astro-glow--one" aria-hidden="true" />
      <div className="astro-glow astro-glow--two" aria-hidden="true" />
      <header className="border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/90 overflow-hidden border border-white/20 shadow-sm">
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
            <p className="text-lg font-semibold leading-tight font-display">Astronote</p>
            <p className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary">Navigation</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center shadow-[0_40px_120px_-80px_rgba(18,198,181,0.9)]">
          <p className="text-xs uppercase tracking-[0.3em] text-text-tertiary">404</p>
          <h1 className="mt-3 text-3xl font-bold font-display">Page not found</h1>
          <p className="mt-3 text-sm text-text-secondary">
            The page you’re looking for doesn’t exist or has moved. Try heading back to the homepage.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#041b1f] hover:bg-accent-hover transition"
            >
              Go home
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-white/10 transition"
            >
              Contact support
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-text-tertiary uppercase tracking-[0.24em] text-center">
          Astronote Public Pages
        </div>
      </footer>
    </div>
  );
}
