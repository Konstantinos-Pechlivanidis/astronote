import type { CSSProperties, ReactNode } from 'react';

export function JoinPageShell({
  children,
  header,
  footer,
  style,
}: {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      className="w-full min-h-screen text-[#EAF0FF] bg-gradient-to-b from-[#070B12] via-[#0B1220] to-[#070B12]"
      style={style}
    >
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, var(--join-glow), transparent 70%)',
            }}
          />
          <div
            className="absolute top-16 -right-28 h-[460px] w-[460px] rounded-full opacity-55 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, var(--join-glow-secondary), transparent 70%)',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_60%)]" />
          <div
            className="absolute inset-0 opacity-25 mix-blend-soft-light"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
              backgroundSize: '3px 3px',
            }}
          />
        </div>
        <section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-10 lg:py-16">
          {header ? <div className="flex justify-end mb-8 lg:mb-0">{header}</div> : null}
          {children}
          {footer ? <div className="pt-8 lg:pt-12">{footer}</div> : null}
        </section>
      </div>
    </div>
  );
}
