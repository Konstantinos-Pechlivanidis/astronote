import type { CSSProperties, ReactNode } from 'react';

type JoinCleanShellProps = {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  style?: CSSProperties
};

/**
 * Clean page wrapper with light neutral background
 */
export function JoinCleanShell({ children, header, footer, style }: JoinCleanShellProps) {
  return (
    <div className="min-h-screen bg-slate-50" style={style}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {header && <div className="mb-8">{header}</div>}
        {children}
        {footer && <div className="mt-12 border-t border-slate-200 pt-8">{footer}</div>}
      </div>
    </div>
  );
}

