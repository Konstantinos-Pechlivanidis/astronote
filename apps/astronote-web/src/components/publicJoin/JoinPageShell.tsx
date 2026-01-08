import type { CSSProperties, ReactNode } from 'react';

type JoinPageShellProps = {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  style?: CSSProperties
};

/**
 * Full-page wrapper for join page
 * Provides dark gradient background with spotlight effects
 */
export function JoinPageShell({ children, header, footer, style }: JoinPageShellProps) {
  return (
    <div
      className="relative min-h-screen w-full bg-gradient-to-br from-[#070B12] via-[#0B1220] to-[#070B12] text-white"
      style={style}
    >
      {/* Gradient spotlight effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -left-1/4 top-0 h-[600px] w-[600px] rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--theme-glow, #0ABAB5) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -right-1/4 top-1/3 h-[500px] w-[500px] rounded-full opacity-25 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, var(--theme-glow-secondary, #3B82F6) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Subtle noise texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
          {header && <div className="mb-8 flex justify-end">{header}</div>}
          {children}
          {footer && <div className="mt-12 pt-8">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

