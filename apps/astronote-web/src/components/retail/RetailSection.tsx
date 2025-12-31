'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RetailSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function RetailSection({
  title,
  description,
  children,
  className,
  titleClassName,
}: RetailSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && (
            <h3
              className={cn(
                'text-lg font-semibold text-text-primary',
                titleClassName,
              )}
            >
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

