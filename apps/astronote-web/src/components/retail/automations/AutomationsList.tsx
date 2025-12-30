'use client';

import { AutomationCard } from './AutomationCard';
import type { AutomationsResponse } from '@/src/lib/retail/api/automations';

interface AutomationsListProps {
  automations?: AutomationsResponse
}

export function AutomationsList({ automations }: AutomationsListProps) {
  if (!automations) return null;

  const automationList = [];
  if (automations.welcome) {
    automationList.push(automations.welcome);
  }
  if (automations.birthday) {
    automationList.push(automations.birthday);
  }

  if (automationList.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-text-secondary">No automations available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {automationList.map((automation) => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
}

