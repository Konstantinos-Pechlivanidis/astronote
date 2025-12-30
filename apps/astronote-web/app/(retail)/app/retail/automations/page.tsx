'use client';

import { Zap, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAutomations } from '@/src/features/retail/automations/hooks/useAutomations';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { AutomationsList } from '@/src/components/retail/automations/AutomationsList';
import { AutomationsSkeleton } from '@/src/components/retail/automations/AutomationsSkeleton';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';

export default function AutomationsPage() {
  const { data: automations, isLoading, error, refetch } = useAutomations();
  const billingGate = useBillingGate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Automations</h1>
          <p className="text-sm text-text-secondary mt-1">
            Automatically send welcome and birthday messages to your contacts
          </p>
        </div>
      </div>

      {/* Billing Gate Banner */}
      {!billingGate.isLoading && !billingGate.canSendCampaigns && (
        <GlassCard className="bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Subscription required:</strong> Active subscription is required to enable automations.{' '}
                <Link href="/app/retail/billing" className="underline font-medium">
                  Go to Billing
                </Link>
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {isLoading && <AutomationsSkeleton />}

      {error && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading automations</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      )}

      {!isLoading && !error && automations && <AutomationsList automations={automations} />}
    </div>
  );
}
