'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RetailPageHeaderProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function RetailPageHeader({
  title,
  description,
  actions,
  className,
}: RetailPageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl font-display">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-text-tertiary">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">{actions}</div>
      )}
    </div>
  );
}
