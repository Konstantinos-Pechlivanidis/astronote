'use client';

import type { ReactNode } from 'react';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';

type PageLayoutProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
};

/**
 * Shared page wrapper for app routes (Retail + Shopify).
 * Uses existing Retail spacing + typography and the shared AppPageHeader wrapper.
 */
export function PageLayout({
  title,
  description,
  actions,
  backHref,
  backLabel,
  children,
}: PageLayoutProps) {
  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <AppPageHeader
          title={title}
          description={description}
          actions={actions}
          backHref={backHref}
          backLabel={backLabel}
        />
        {children}
      </div>
    </RetailPageLayout>
  );
}


