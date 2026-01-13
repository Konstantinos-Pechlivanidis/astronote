'use client';

import { cn } from '@/lib/utils';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetailCard } from './RetailCard';

interface RetailErrorBannerProps {
  /**
   * Error message or title
   */
  title: string;
  /**
   * Additional error description
   */
  description?: string;
  /**
   * Error details (stack trace, code, etc.) - shown in expandable section
   */
  details?: string;
  /**
   * Retry action button
   */
  onRetry?: () => void;
  /**
   * Dismiss action
   */
  onDismiss?: () => void;
  /**
   * Show as inline banner (not full card)
   * @default false
   */
  inline?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Error Banner Component
 * Consistent error display with optional retry/dismiss actions
 */
export function RetailErrorBanner({
  title,
  description,
  details,
  onRetry,
  onDismiss,
  inline = false,
  className,
}: RetailErrorBannerProps) {
  const content = (
    <div className="flex items-start gap-4">
      <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-red-400" />
      <div className="flex-1">
        <h3 className="mb-2 text-lg font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="mb-4 text-sm text-text-secondary">{description}</p>
        )}
        {details && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary">
              Show details
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-surface-light p-2 text-xs text-text-tertiary">
              {details}
            </pre>
          </details>
        )}
        {(onRetry || onDismiss) && (
          <div className="mt-4 flex gap-2">
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button onClick={onDismiss} variant="ghost" size="sm">
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>
      {onDismiss && !onRetry && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-text-tertiary hover:text-text-primary"
          aria-label="Dismiss error"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );

  if (inline) {
    return (
      <div
        className={cn(
          'rounded-lg border border-red-200 bg-red-50/50 p-4',
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <RetailCard variant="danger" className={cn('p-6', className)}>
      {content}
    </RetailCard>
  );
}

