'use client';

import { useMe } from '@/src/features/retail/settings/hooks/useMe';
import { ProfileCard } from '@/src/components/retail/settings/ProfileCard';
import { SecurityCard } from '@/src/components/retail/settings/SecurityCard';
import { BillingSummaryCard } from '@/src/components/retail/settings/BillingSummaryCard';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <RetailCard className="lg:col-span-2">
        <div className="space-y-4">
          <div className="h-5 w-40 rounded bg-surface-light animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 rounded bg-surface-light animate-pulse" />
            <div className="h-10 rounded bg-surface-light animate-pulse" />
          </div>
          <div className="h-24 rounded bg-surface-light animate-pulse" />
        </div>
      </RetailCard>

      <RetailCard>
        <div className="space-y-4">
          <div className="h-5 w-32 rounded bg-surface-light animate-pulse" />
          <div className="h-20 rounded bg-surface-light animate-pulse" />
          <div className="h-10 rounded bg-surface-light animate-pulse" />
        </div>
      </RetailCard>

      <RetailCard className="lg:col-span-2">
        <div className="space-y-4">
          <div className="h-5 w-28 rounded bg-surface-light animate-pulse" />
          <div className="h-10 rounded bg-surface-light animate-pulse" />
          <div className="h-10 rounded bg-surface-light animate-pulse" />
        </div>
      </RetailCard>
    </div>
  );
}

export default function SettingsPage() {
  const { data: user, isLoading, error, refetch } = useMe();

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Settings"
          description="Manage your account, security, and preferences."
          actions={
            <Button onClick={() => refetch()} variant="outline" size="sm" className="shrink-0">
              Refresh
            </Button>
          }
        />

        {/* Loading */}
        {isLoading && <SettingsSkeleton />}

        {/* Error */}
        {!isLoading && error && (
          <RetailCard variant="danger">
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2">
                <p className="text-sm font-medium text-red-500">Error loading settings</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Please try again. If the issue persists, check your session and network.
                </p>
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: Profile + Security */}
            <div className="space-y-6 lg:col-span-2">
              <ProfileCard user={user} isLoading={false} />
              <SecurityCard />
            </div>

            {/* Right column: Billing summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <BillingSummaryCard />
              </div>
            </div>
          </div>
        )}
      </div>
    </RetailPageLayout>
  );
}
