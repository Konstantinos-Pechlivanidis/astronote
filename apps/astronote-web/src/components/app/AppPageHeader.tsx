'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';

type AppPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
};

/**
 * Shared page header for app pages (Shopify + Retail)
 * - Keeps Retail typography and spacing
 * - Optional "Back" affordance without each page re-implementing it
 */
export function AppPageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
  className,
}: AppPageHeaderProps) {
  if (!backHref) {
    return (
      <RetailPageHeader
        title={title}
        description={description}
        actions={actions}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="min-h-[44px] px-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </Link>
      </div>
      <RetailPageHeader title={title} description={description} actions={actions} className="mb-0" />
    </div>
  );
}


