'use client';

import { useMemo, useState } from 'react';
import { Edit, Sparkles } from 'lucide-react';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { useUpdateAutomationLibrary } from '@/src/features/retail/automations/hooks/useUpdateAutomationLibrary';
import type { AutomationLibraryPreset } from '@/src/lib/retail/api/automationLibrary';

function formatOffset(minutes?: number) {
  if (!minutes) return 'at time';
  const abs = Math.abs(minutes);
  if (abs >= 1440) {
    const days = Math.round(abs / 1440);
    return minutes < 0 ? `${days}d before` : `${days}d after`;
  }
  if (abs >= 60) {
    const hours = Math.round(abs / 60);
    return minutes < 0 ? `${hours}h before` : `${hours}h after`;
  }
  return minutes < 0 ? `${abs}m before` : `${abs}m after`;
}

function getTriggerLabel(preset: AutomationLibraryPreset) {
  if (preset.trigger.type === 'event') {
    const event = preset.trigger.eventType.replace('_', ' ');
    const status = preset.trigger.status ? preset.trigger.status.replace('_', ' ') : 'scheduled';
    const field = preset.trigger.timeField === 'endAt' ? 'end' : 'start';
    const offset = formatOffset(preset.trigger.offsetMinutes);
    return `${event} ${status} • ${field} ${offset}`;
  }
  if (preset.trigger.type === 'inactivity') {
    const days = preset.trigger.inactivityDays || 0;
    const types = preset.trigger.eventTypes?.length ? preset.trigger.eventTypes.join(', ') : 'activity';
    return `No ${types} for ${days} days`;
  }
  return '—';
}

interface AutomationLibraryListProps {
  presets: AutomationLibraryPreset[];
  businessProfile: string;
}

export function AutomationLibraryList({ presets, businessProfile }: AutomationLibraryListProps) {
  const updateMutation = useUpdateAutomationLibrary();
  const billingGate = useBillingGate();
  const [editingPreset, setEditingPreset] = useState<AutomationLibraryPreset | null>(null);
  const [draftBody, setDraftBody] = useState('');

  const canToggle = billingGate.canSendCampaigns;

  const profileLabel = useMemo(() => {
    if (!businessProfile) return 'Retail';
    return businessProfile.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [businessProfile]);

  const handleEdit = (preset: AutomationLibraryPreset) => {
    setEditingPreset(preset);
    setDraftBody(preset.messageBody || preset.defaultTemplate);
  };

  const handleSave = () => {
    if (!editingPreset) return;
    updateMutation.mutate({
      key: editingPreset.key,
      data: { messageBody: draftBody },
    }, {
      onSuccess: () => {
        setEditingPreset(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      <RetailCard className="border-border bg-background/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-text-primary">Automation Library</div>
            <p className="text-sm text-text-secondary">
              Presets tailored for {profileLabel} businesses. Activate what you need and edit the message copy.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-light px-3 py-1 text-xs text-text-secondary">
            <Sparkles className="h-3.5 w-3.5" />
            Profile: {profileLabel}
          </div>
        </div>
      </RetailCard>

      <div className="grid gap-4 md:grid-cols-2">
        {presets.map((preset) => {
          const isUpdating = updateMutation.isPending && updateMutation.variables?.key === preset.key;
          return (
            <RetailCard key={preset.key} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-base font-semibold text-text-primary">{preset.name}</div>
                  <div className="text-sm text-text-secondary">{preset.description}</div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${
                  preset.messageType === 'service'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {preset.messageType === 'service' ? 'Service' : 'Marketing'}
                </span>
              </div>

              <div className="text-xs text-text-tertiary">Trigger</div>
              <div className="text-sm text-text-secondary">{getTriggerLabel(preset)}</div>

              <div className="text-xs text-text-tertiary">Message</div>
              <div className="rounded border border-border bg-surface-light p-3 text-sm text-text-primary">
                {preset.messageBody || preset.defaultTemplate}
              </div>

              {preset.stats && (
                <div className="grid grid-cols-3 gap-2 text-xs text-text-secondary">
                  <div className="rounded border border-border bg-background px-2 py-1 text-center">
                    7d: {preset.stats.sentLast7Days}
                  </div>
                  <div className="rounded border border-border bg-background px-2 py-1 text-center">
                    30d: {preset.stats.sentLast30Days}
                  </div>
                  <div className="rounded border border-border bg-background px-2 py-1 text-center">
                    Last run: {preset.stats.lastRunAt ? new Date(preset.stats.lastRunAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    if (!canToggle) return;
                    updateMutation.mutate({
                      key: preset.key,
                      data: { isActive: !preset.isActive },
                    });
                  }}
                  disabled={!canToggle || isUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                    preset.isActive ? 'bg-accent border-accent' : 'bg-surface-light border-border'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={preset.isActive ? 'Disable preset' : 'Enable preset'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ${
                      preset.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(preset)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
              {!canToggle && (
                <p className="text-xs text-text-tertiary">
                  An active subscription is required to enable automation presets.
                </p>
              )}
            </RetailCard>
          );
        })}
      </div>

      {editingPreset && (
        <Dialog
          open={Boolean(editingPreset)}
          onClose={() => setEditingPreset(null)}
          title={`Edit: ${editingPreset.name}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Update the message copy for this preset. Personalization tokens like {'{{first_name}}'} are supported.
            </p>
            <Textarea rows={6} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPreset(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
