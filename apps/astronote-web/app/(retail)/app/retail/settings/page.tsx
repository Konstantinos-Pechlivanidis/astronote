'use client';

import { Settings } from 'lucide-react';
import { useMe } from '@/src/features/retail/settings/hooks/useMe';
import { ProfileCard } from '@/src/components/retail/settings/ProfileCard';
import { SecurityCard } from '@/src/components/retail/settings/SecurityCard';
import { BillingSummaryCard } from '@/src/components/retail/settings/BillingSummaryCard';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { data: user, isLoading, error, refetch } = useMe();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your account, security, and preferences
          </p>
        </div>
      </div>

      {isLoading && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">Loading settings...</p>
          </div>
        </GlassCard>
      )}

      {error && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading settings</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      )}

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* Account / Profile Section */}
          <ProfileCard user={user} isLoading={isLoading} />

          {/* Security Section */}
          <SecurityCard />

          {/* Billing Summary Section (Read-only) */}
          <BillingSummaryCard />
        </div>
      )}
    </div>
  );
}
