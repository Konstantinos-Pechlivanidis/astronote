'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RetailCard } from './RetailCard';

interface RetailLoadingSkeletonProps {
  /**
   * Number of skeleton rows to show
   * @default 5
   */
  rows?: number;
  /**
   * Number of columns (for grid layouts)
   * @default 1
   */
  columns?: number;
  /**
   * Custom skeleton content
   */
  children?: ReactNode;
  /**
   * Show as table skeleton
   */
  asTable?: boolean;
  /**
   * Table columns count (when asTable is true)
   */
  tableColumns?: number;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Generic Loading Skeleton Component
 * Provides consistent loading states across the app
 */
export function RetailLoadingSkeleton({
  rows = 5,
  columns = 1,
  children,
  asTable = false,
  tableColumns = 5,
  className,
}: RetailLoadingSkeletonProps) {
  // Custom skeleton content
  if (children) {
    return <div className={cn('animate-pulse', className)}>{children}</div>;
  }

  // Table skeleton
  if (asTable) {
    return (
      <RetailCard className={cn('overflow-hidden p-0', className)}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-light">
              <tr>
                {Array.from({ length: tableColumns }).map((_, i) => (
                  <th key={i} className="px-6 py-3">
                    <div className="h-4 bg-surface-light rounded w-24 animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: tableColumns }).map((_, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-surface-light rounded w-20 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RetailCard>
    );
  }

  // Grid skeleton
  if (columns > 1) {
    return (
      <div className={cn('grid grid-cols-1 gap-6', `sm:grid-cols-${columns}`, className)}>
        {Array.from({ length: rows * columns }).map((_, i) => (
          <RetailCard key={i} className="p-6">
            <div className="space-y-4">
              <div className="h-6 w-32 bg-surface-light rounded animate-pulse" />
              <div className="h-8 w-24 bg-surface-light rounded animate-pulse" />
              <div className="h-4 w-40 bg-surface-light rounded animate-pulse" />
            </div>
          </RetailCard>
        ))}
      </div>
    );
  }

  // List skeleton (default)
  return (
    <RetailCard className={cn('p-6', className)}>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-light rounded animate-pulse" />
        ))}
      </div>
    </RetailCard>
  );
}

/**
 * Skeleton for form fields
 */
export function RetailFormFieldSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 bg-surface-light rounded animate-pulse" />
          <div className="h-10 w-full bg-surface-light rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for card grid
 */
export function RetailCardGridSkeleton({
  count = 6,
  columns = 3,
}: {
  count?: number;
  columns?: number;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <RetailCard key={i} className="p-6">
          <div className="space-y-4">
            <div className="h-6 w-32 bg-surface-light rounded animate-pulse" />
            <div className="h-8 w-24 bg-surface-light rounded animate-pulse" />
            <div className="h-4 w-40 bg-surface-light rounded animate-pulse" />
          </div>
        </RetailCard>
      ))}
    </div>
  );
}

