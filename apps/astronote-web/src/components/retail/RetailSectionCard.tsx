'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RetailCard } from './RetailCard';

interface RetailSectionCardProps {
  /**
   * Section title
   */
  title?: string;
  /**
   * Section description/subtitle
   */
  description?: string;
  /**
   * Actions (buttons, links) in the header
   */
  actions?: ReactNode;
  /**
   * Card content
   */
  children: ReactNode;
  /**
   * Show divider between header and content
   * @default true
   */
  showDivider?: boolean;
  /**
   * Card variant
   * @default 'default'
   */
  variant?: 'default' | 'subtle' | 'danger' | 'info';
  /**
   * Additional className
   */
  className?: string;
  /**
   * Header className
   */
  headerClassName?: string;
}

/**
 * Section Card Component
 * Card with optional header row, divider, and consistent spacing
 */
export function RetailSectionCard({
  title,
  description,
  actions,
  children,
  showDivider = true,
  variant = 'default',
  className,
  headerClassName,
}: RetailSectionCardProps) {
  const hasHeader = title || description || actions;

  return (
    <RetailCard variant={variant} className={cn('p-6', className)}>
      {hasHeader && (
        <div
          className={cn(
            'mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
            headerClassName,
          )}
        >
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            )}
            {description && (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">{actions}</div>
          )}
        </div>
      )}

      {hasHeader && showDivider && (
        <div className="mb-6 border-b border-border" />
      )}

      <div>{children}</div>
    </RetailCard>
  );
}

