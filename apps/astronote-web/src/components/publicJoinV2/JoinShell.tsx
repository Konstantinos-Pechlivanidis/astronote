import type { ReactNode } from 'react';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';

type JoinShellProps = {
  children: ReactNode
};

/**
 * Premium dark shell with subtle gradient
 */
export function JoinShell({ children }: JoinShellProps) {
  return (
    <PublicLayout>
      {children}
    </PublicLayout>
  );
}
