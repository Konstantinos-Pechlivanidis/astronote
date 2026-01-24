'use client';

import { CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';

export function BillingSummaryCard() {
  const billingGate = useBillingGate();

  if (billingGate.isLoading) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Billing Status</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-text-secondary">Loading billing information...</p>
        </div>
      </GlassCard>
    );
  }

  if (billingGate.error) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Billing Status</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-red-400">Error loading billing information</p>
        </div>
      </GlassCard>
    );
  }

  const subscription = billingGate.subscription || { active: false, planType: null };
  const credits = billingGate.credits || 0;
  const nextRenewal = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Billing Status</h2>
      </div>

      <div className="space-y-4">
        {/* Subscription Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Subscription Status
          </label>
          <div className="flex items-center gap-3">
            {subscription.active ? (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                Inactive
              </span>
            )}
            <span className="text-sm text-text-secondary">
              {subscription.active
                ? subscription.planType
                  ? `${subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)} Plan`
                  : 'Active'
                : 'Inactive'}
            </span>
          </div>
          {nextRenewal && (
            <div className="mt-2 text-xs text-text-tertiary">
              Next renewal: {nextRenewal.toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Credits Balance */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Credits Balance</label>
          <p className="text-lg font-semibold text-text-primary">{credits.toLocaleString()}</p>
          <p className="text-xs text-text-tertiary mt-1">
            Credits accumulate and never expire; spending requires an active subscription.
          </p>
        </div>

        {/* CTA Button */}
        <div className="pt-4 border-t border-border">
          <Link href="/app/retail/billing">
            <Button variant="outline" size="sm" className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Go to Billing
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
