'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface RetailFormLayoutProps {
  children: ReactNode;
  /**
   * Number of columns on desktop (1-4)
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;
  /**
   * Spacing between form fields
   * @default 'space-y-6'
   */
  spacing?: string;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Form Layout Component
 * Provides consistent form field spacing and responsive grid layout
 */
export function RetailFormLayout({
  children,
  columns = 1,
  spacing = 'space-y-6',
  className,
}: RetailFormLayoutProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  // If single column, use vertical spacing
  if (columns === 1) {
    return <div className={cn(spacing, className)}>{children}</div>;
  }

  // Multi-column grid
  return (
    <div className={cn('grid gap-6', gridClasses[columns], className)}>
      {children}
    </div>
  );
}

/**
 * Form Section Component
 * Groups related form fields with optional title and description
 */
interface RetailFormSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function RetailFormSection({
  title,
  description,
  children,
  className,
}: RetailFormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="pb-2 border-b border-border">
          {title && (
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
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

/**
 * Form Actions Component
 * Consistent button placement for form actions
 */
interface RetailFormActionsProps {
  children: ReactNode;
  /**
   * Align actions to the right
   * @default false
   */
  alignRight?: boolean;
  className?: string;
}

export function RetailFormActions({
  children,
  alignRight = false,
  className,
}: RetailFormActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 pt-4 border-t border-border',
        alignRight && 'justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

