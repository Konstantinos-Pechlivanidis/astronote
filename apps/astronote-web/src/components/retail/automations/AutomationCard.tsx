'use client';

import { useState } from 'react';
import { Edit, Mail, Calendar } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { useUpdateAutomation } from '@/src/features/retail/automations/hooks/useUpdateAutomation';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { AutomationEditorModal } from './AutomationEditorModal';
import type { Automation } from '@/src/lib/retail/api/automations';

const AUTOMATION_INFO: Record<string, { name: string; description: string; icon: typeof Mail; trigger: string }> = {
  welcome_message: {
    name: 'Welcome Message',
    description: 'Automatically sends a welcome message when a new contact is added',
    icon: Mail,
    trigger: 'New contact added',
  },
  birthday_message: {
    name: 'Birthday Message',
    description: 'Automatically sends a birthday message on the contact&apos;s birthday',
    icon: Calendar,
    trigger: 'Contact birthday',
  },
};

interface AutomationCardProps {
  automation: Automation
}

export function AutomationCard({ automation }: AutomationCardProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const updateMutation = useUpdateAutomation();
  const billingGate = useBillingGate();

  if (!automation) return null;

  const info = AUTOMATION_INFO[automation.type] || AUTOMATION_INFO.welcome_message;
  const Icon = info.icon;
  const conversionRate = automation.stats
    ? Math.round((automation.stats.conversionRate || 0) * 100)
    : 0;

  const handleToggle = () => {
    if (updateMutation.isPending) return;
    if (!billingGate.canSendCampaigns) {
      return;
    }

    updateMutation.mutate({
      type: automation.type,
      data: { isActive: !automation.isActive },
    });
  };

  const canToggle = billingGate.canSendCampaigns;

  return (
    <>
      <GlassCard>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary">{info.name}</h3>
              <p className="text-sm text-text-secondary mt-1">{info.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                automation.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {automation.isActive ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={handleToggle}
              disabled={updateMutation.isPending || !canToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 border ${
                automation.isActive
                  ? 'bg-accent border-accent'
                  : 'bg-gray-100 text-gray-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={
                !canToggle
                  ? 'Subscription required to enable automations'
                  : automation.isActive
                    ? 'Disable automation'
                    : 'Enable automation'
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  automation.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-1">Trigger:</p>
          <p className="text-sm text-text-secondary">{info.trigger}</p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-1">Message:</p>
          <div className="bg-surface-light rounded p-3">
            <p className="text-sm text-text-primary whitespace-pre-wrap">
              {automation.messageBody || '—'}
            </p>
          </div>
        </div>

        {automation.stats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-surface-light px-3 py-2">
              <p className="text-xs text-text-tertiary">Sent</p>
              <p className="text-sm font-semibold text-text-primary">{automation.stats.sent}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-light px-3 py-2">
              <p className="text-xs text-text-tertiary">Conversions</p>
              <p className="text-sm font-semibold text-text-primary">{automation.stats.conversions}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-light px-3 py-2">
              <p className="text-xs text-text-tertiary">Conv. rate</p>
              <p className="text-sm font-semibold text-text-primary">{conversionRate}%</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => setIsEditorOpen(true)} size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit Message
          </Button>
        </div>
      </GlassCard>

      {isEditorOpen && (
        <AutomationEditorModal
          automation={automation}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </>
  );
}
