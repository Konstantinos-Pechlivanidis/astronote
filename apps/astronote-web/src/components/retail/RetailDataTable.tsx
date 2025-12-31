'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { RetailCard } from './RetailCard';
import { EmptyState } from './EmptyState';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string | ReactNode;
  render?: (_item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface RetailDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (_item: T) => string | number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  error?: string;
  onRetry?: () => void;
  mobileCardRender?: (_item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((_item: T) => string);
  onRowClick?: (_item: T) => void;
}

export function RetailDataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyTitle = 'No items found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  error,
  onRetry,
  mobileCardRender,
  className,
  headerClassName,
  rowClassName,
  onRowClick,
}: RetailDataTableProps<T>) {
  // Error state
  if (error) {
    return (
      <RetailCard>
        <div className="py-8 text-center">
          <p className="mb-4 text-red-400">{error}</p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              Retry
            </Button>
          )}
        </div>
      </RetailCard>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <RetailCard>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </RetailCard>
    );
  }

  // Desktop table
  const desktopTable = (
    <div className="hidden md:block">
      <RetailCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-light">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary',
                      col.headerClassName,
                      headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {data.map((item) => {
                const key = keyExtractor(item);
                const rowClass =
                  typeof rowClassName === 'function'
                    ? rowClassName(item)
                    : rowClassName;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      'transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-surface',
                      rowClass,
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'whitespace-nowrap px-6 py-4 text-sm',
                          col.className,
                        )}
                      >
                        {col.render
                          ? col.render(item)
                          : (item as any)[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </RetailCard>
    </div>
  );

  // Mobile cards
  const mobileCards = (
    <div className="space-y-4 md:hidden">
      {mobileCardRender
        ? data.map((item) => (
          <div key={keyExtractor(item)}>{mobileCardRender(item)}</div>
        ))
        : data.map((item) => (
          <RetailCard
            key={keyExtractor(item)}
            hover={!!onRowClick}
            onClick={() => onRowClick?.(item)}
            className={cn(onRowClick && 'cursor-pointer', className)}
          >
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col.key} className="flex justify-between">
                  <span className="text-sm font-medium text-text-secondary">
                    {col.header}:
                  </span>
                  <span className="text-sm text-text-primary">
                    {col.render
                      ? col.render(item)
                      : (item as any)[col.key]}
                  </span>
                </div>
              ))}
            </div>
          </RetailCard>
        ))}
    </div>
  );

  return (
    <div className={className}>
      {desktopTable}
      {mobileCards}
    </div>
  );
}

