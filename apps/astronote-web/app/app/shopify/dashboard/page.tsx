'use client';

import { useDashboardKPIs } from '@/src/features/shopify/dashboard/hooks/useDashboardKPIs';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  MessageSquare,
  Users,
  Send,
  Zap,
  AlertCircle,
} from 'lucide-react';

/**
 * KPI Card Component
 */
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: typeof CreditCard;
}) {
  return (
    <RetailCard hover className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        {Icon && <Icon className="h-5 w-5 text-text-tertiary" />}
      </div>
      <div className="flex items-baseline">
        <p className="text-3xl font-bold text-text-primary">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      {subtitle && (
        <p className="mt-2 text-xs text-text-tertiary">{subtitle}</p>
      )}
    </RetailCard>
  );
}

/**
 * Loading Skeleton for KPI Card
 */
function KPICardSkeleton() {
  return (
    <RetailCard className="p-6">
      <div className="mb-4 h-6 w-32 animate-pulse rounded bg-surface-light" />
      <div className="mb-2 h-8 w-24 animate-pulse rounded bg-surface-light" />
      <div className="h-4 w-40 animate-pulse rounded bg-surface-light" />
    </RetailCard>
  );
}

/**
 * Shopify Dashboard Page
 * Displays KPIs: Credits, Campaigns, Contacts, Messages Sent
 */
export default function ShopifyDashboardPage() {
  const {
    credits,
    totalCampaigns,
    totalContacts,
    totalMessagesSent,
    activeAutomations,
    isInitialLoad,
    error,
    refetch,
  } = useDashboardKPIs();

  // Show loading skeletons on initial load
  if (isInitialLoad) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Dashboard"
            description="Welcome to your Shopify SMS marketing dashboard"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <KPICardSkeleton key={i} />
            ))}
          </div>
        </div>
      </RetailPageLayout>
    );
  }

  // Show error state (inline, doesn't block navigation)
  if (error) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader
            title="Dashboard"
            description="Welcome to your Shopify SMS marketing dashboard"
          />

          {/* Error Alert Card */}
          <RetailCard variant="danger" className="mb-6 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="mt-1 h-6 w-6 shrink-0 text-red-400" />
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-semibold text-text-primary">
                Error Loading Dashboard Data
                </h3>
                <p className="mb-4 text-sm text-text-secondary">
                  {error instanceof Error
                    ? error.message
                    : 'Failed to load dashboard KPIs. Please try again.'}
                </p>
                <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
                </Button>
              </div>
            </div>
          </RetailCard>

          {/* Show KPI cards even on error (with zeros) - don't block entire page */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            <KPICard
              title="SMS Credits"
              value={0}
              subtitle="Available credits"
              icon={CreditCard}
            />
            <KPICard
              title="Total Campaigns"
              value={0}
              subtitle="All time"
              icon={MessageSquare}
            />
            <KPICard
              title="Total Contacts"
              value={0}
              subtitle="All contacts"
              icon={Users}
            />
            <KPICard
              title="Messages Sent"
              value={0}
              subtitle="All time"
              icon={Send}
            />
          </div>
        </div>
      </RetailPageLayout>
    );
  }

  // Check if all data is zero/null (empty state)
  const hasNoData =
    credits === 0 &&
    totalCampaigns === 0 &&
    totalContacts === 0 &&
    totalMessagesSent === 0;

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Dashboard"
          description="Welcome to your Shopify SMS marketing dashboard"
        />

        {/* KPI Cards Grid - Responsive */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          <KPICard
            title="SMS Credits"
            value={credits}
            subtitle="Available credits"
            icon={CreditCard}
          />
          <KPICard
            title="Total Campaigns"
            value={totalCampaigns}
            subtitle="All time"
            icon={MessageSquare}
          />
          <KPICard
            title="Total Contacts"
            value={totalContacts}
            subtitle="All contacts"
            icon={Users}
          />
          <KPICard
            title="Messages Sent"
            value={totalMessagesSent}
            subtitle="All time"
            icon={Send}
          />

          {/* Optional: Active Automations (if > 0 or always show) */}
          {activeAutomations !== undefined && (
            <KPICard
              title="Active Automations"
              value={activeAutomations}
              subtitle="Currently active"
              icon={Zap}
            />
          )}
        </div>

        {/* Empty State Message (if all zeros) */}
        {hasNoData && (
          <RetailCard className="mt-6 p-6">
            <div className="text-center py-8">
              <p className="text-text-secondary">
              No data yet. Start by creating your first campaign or importing contacts.
              </p>
            </div>
          </RetailCard>
        )}
      </div>
    </RetailPageLayout>
  );
}
