'use client';

import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

interface RetailCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'danger' | 'info';
  hover?: boolean;
  children: ReactNode;
}

export const RetailCard = forwardRef<HTMLDivElement, RetailCardProps>(
  ({ variant = 'default', hover = false, className, children, ...props }, ref) => {
    const variantClasses = {
      default: '',
      subtle: 'glass-light',
      danger: 'border-red-200 bg-red-50/50',
      info: 'border-blue-200 bg-blue-50/50',
    };

    return (
      <GlassCard
        ref={ref}
        hover={hover}
        light={variant === 'subtle'}
        className={cn('p-5', variantClasses[variant], className)}
        {...props}
      >
        {children}
      </GlassCard>
    );
  },
);

RetailCard.displayName = 'RetailCard';
