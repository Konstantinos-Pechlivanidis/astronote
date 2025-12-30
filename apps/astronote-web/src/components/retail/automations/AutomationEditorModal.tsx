'use client';

import { useEffect } from 'react';
import { Dialog } from '@/src/components/ui/dialog';
import { AutomationForm } from './AutomationForm';
import { useUpdateAutomation } from '@/src/features/retail/automations/hooks/useUpdateAutomation';
import type { Automation } from '@/src/lib/retail/api/automations';

interface AutomationEditorModalProps {
  automation: Automation
  isOpen: boolean
  onClose: () => void
}

const AUTOMATION_NAMES: Record<string, string> = {
  welcome_message: 'Welcome Message',
  birthday_message: 'Birthday Message',
};

export function AutomationEditorModal({ automation, isOpen, onClose }: AutomationEditorModalProps) {
  const updateMutation = useUpdateAutomation();

  // Close modal on successful update
  useEffect(() => {
    if (updateMutation.isSuccess) {
      onClose();
    }
  }, [updateMutation.isSuccess, onClose]);

  if (!isOpen || !automation) return null;

  const automationName = AUTOMATION_NAMES[automation.type] || automation.type;

  return (
    <Dialog open={isOpen} onClose={onClose} title={`Edit ${automationName}`} size="md">
      <AutomationForm
        automation={automation}
        onSubmit={(data) => {
          updateMutation.mutate({
            type: automation.type,
            data: { messageBody: data.messageBody },
          });
        }}
        isSubmitting={updateMutation.isPending}
        onCancel={onClose}
      />
    </Dialog>
  );
}

