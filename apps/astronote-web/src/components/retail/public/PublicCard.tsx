import type { ReactNode } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

export function PublicCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={cn('p-6', className)}>
      {children}
    </GlassCard>
  );
}

