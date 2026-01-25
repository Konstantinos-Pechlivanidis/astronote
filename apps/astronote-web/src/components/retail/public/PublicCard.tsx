import type { ReactNode, CSSProperties } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

export function PublicCard({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <GlassCard className={cn('p-7 sm:p-9 rounded-3xl', className)} style={style}>
      {children}
    </GlassCard>
  );
}
