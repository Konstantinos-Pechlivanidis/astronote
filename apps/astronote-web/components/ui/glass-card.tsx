import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  light?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, light = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'glass rounded-2xl p-6',
          light && 'glass-light',
          hover && 'glass-hover',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';

