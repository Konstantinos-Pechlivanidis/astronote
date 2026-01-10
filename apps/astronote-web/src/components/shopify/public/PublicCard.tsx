import type { ReactNode, CSSProperties } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

/**
 * Shopify Public Card
 * Isolated from Retail public components
 * Used for Shopify public pages (unsubscribe, etc.)
 */
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
    <GlassCard className={cn('p-6', className)} style={style}>
      {children}
    </GlassCard>
  );
}

