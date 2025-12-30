'use client';

import type { ReactNode } from 'react';
import { RetailAuthGuard } from '@/src/components/retail/RetailAuthGuard';
import { RetailShell } from '@/src/components/retail/RetailShell';

export default function RetailAppLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <RetailAuthGuard>
      <RetailShell>{children}</RetailShell>
    </RetailAuthGuard>
  );
}
