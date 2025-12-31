'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RetailPageHeaderProps {
  title: string;
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
        <h1 className="text-3xl font-bold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">{actions}</div>
      )}
    </div>
  );
}

