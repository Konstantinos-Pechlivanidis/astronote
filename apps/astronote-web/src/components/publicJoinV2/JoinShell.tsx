import type { ReactNode } from 'react';
import { THEME } from './theme';

type JoinShellProps = {
  children: ReactNode
};

/**
 * Premium dark shell with subtle gradient
 */
export function JoinShell({ children }: JoinShellProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(ellipse at top, ${THEME.bg.elevated}, ${THEME.bg.page})`,
      }}
    >
      {/* Subtle top glow */}
      <div
        className="fixed top-0 left-0 right-0 h-[400px] opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top, ${THEME.accent.light}, transparent 60%)`,
        }}
      />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

