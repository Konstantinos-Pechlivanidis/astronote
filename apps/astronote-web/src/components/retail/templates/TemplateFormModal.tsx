'use client';

import { Dialog } from '@/src/components/ui/dialog';
import { TemplateForm } from './TemplateForm';
import type { Template } from '@/src/lib/retail/api/templates';
import type { z } from 'zod';
import { templateSchema } from '@/src/lib/retail/validators';

interface TemplateFormModalProps {
  open: boolean
  onClose: () => void
  template?: Template | null
  onSubmit: (_data: z.infer<typeof templateSchema>) => void
  isLoading?: boolean
  systemUserId?: number
}

export function TemplateFormModal({
  open,
  onClose,
  template,
  onSubmit,
  isLoading,
  systemUserId,
}: TemplateFormModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? 'Edit Template' : 'Create Template'}
      size="lg"
    >
      <TemplateForm
        template={template}
        onSubmit={onSubmit}
        isLoading={isLoading}
        systemUserId={systemUserId}
      />
    </Dialog>
  );
}

