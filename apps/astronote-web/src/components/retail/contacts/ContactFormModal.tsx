'use client';

import { Dialog } from '@/src/components/ui/dialog';
import { ContactForm } from './ContactForm';
import type { Contact } from '@/src/lib/retail/api/contacts';
import type { z } from 'zod';
import { contactSchema } from '@/src/lib/retail/validators';

interface ContactFormModalProps {
  open: boolean
  onClose: () => void
  contact?: Contact | null
  onSubmit: (_data: z.infer<typeof contactSchema>) => void
  isLoading?: boolean
}

export function ContactFormModal({
  open,
  onClose,
  contact,
  onSubmit,
  isLoading,
}: ContactFormModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={contact ? 'Edit Contact' : 'Add Contact'}
      size="md"
    >
      <ContactForm contact={contact} onSubmit={onSubmit} isLoading={isLoading} />
    </Dialog>
  );
}

