'use client';

import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';

/**
 * Shopify Reports Page
 * Placeholder for Phase 1 - will be implemented in Phase 9
 */
export default function ShopifyReportsPage() {
  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader title="Reports" description="View performance reports" />
        <RetailCard className="p-6">
          <p className="text-text-secondary">Reports coming soon in Phase 9</p>
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}

