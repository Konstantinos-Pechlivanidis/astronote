'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { useAutomations } from '@/src/features/retail/automations/hooks/useAutomations';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { AutomationsList } from '@/src/components/retail/automations/AutomationsList';
import { AutomationsSkeleton } from '@/src/components/retail/automations/AutomationsSkeleton';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';

export default function AutomationsPage() {
  const { data: automations, isLoading, error, refetch } = useAutomations();
  const billingGate = useBillingGate();

  const showBillingGate =
    !billingGate.isLoading && billingGate.canSendCampaigns === false;

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Automations"
          description="Automatically send welcome and birthday messages to your contacts."
        />

        {/* Billing Gate */}
        {showBillingGate && (
          <RetailCard className="border-border bg-background/70">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: icon + copy */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10">
                  <AlertCircle className="h-5 w-5 text-yellow-700" />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">
                    Subscription required
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">
                    You need an active subscription to enable automations.
                  </p>
                </div>
              </div>

              {/* Right: CTA button (always visible + responsive) */}
              <Link href="/app/retail/billing" className="w-full sm:w-auto sm:min-w-[160px]">
                <Button variant="outline" size="sm" className="w-full">
                  Go to Billing
                </Button>
              </Link>
            </div>
          </RetailCard>
        )}

        {/* Loading */}
        {isLoading && <AutomationsSkeleton />}

        {/* Error */}
        {error && (
          <RetailCard variant="danger">
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="text-sm font-semibold text-red-500">
                Couldn&apos;t load automations
              </div>
              <div className="max-w-md text-sm text-text-secondary">
                Please try again. If the issue persists, check your network and
                backend logs.
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Content */}
        {!isLoading && !error && automations && (
          <div className="space-y-4">
            {/* Optional helper card - remove if you want it even more minimal */}
            <RetailCard className="border-border bg-background/60">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-text-primary">
                  How automations work
                </div>
                <p className="text-sm text-text-secondary">
                  Turn an automation on to start sending messages automatically.
                  You can disable it anytime — changes apply instantly.
                </p>
              </div>
            </RetailCard>

            <AutomationsList automations={automations} />
          </div>
        )}
      </div>
    </RetailPageLayout>
  );
}
