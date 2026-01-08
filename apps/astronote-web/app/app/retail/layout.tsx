import type { ReactNode } from 'react';
import { RetailAuthGuard } from '@/src/components/retail/RetailAuthGuard';
import { RetailLayoutShell } from './_components/RetailShell';

export default function RetailLayout({ children }: { children: ReactNode }) {
  return (
    <RetailAuthGuard>
      <RetailLayoutShell>{children}</RetailLayoutShell>
    </RetailAuthGuard>
  );
}
