'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Edit, Trash2 } from 'lucide-react';
import { SubscriptionBadge } from './SubscriptionBadge';
import { maskPhone } from '@/src/lib/retail/utils/phone';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/src/lib/retail/api/contacts';

interface ContactsTableProps {
  contacts: Contact[]
  onEdit: (_contact: Contact) => void
  onDelete: (_id: number) => void
}

export function ContactsTable({ contacts, onEdit, onDelete }: ContactsTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null);

  if (!contacts || contacts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <RetailCard>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-surface">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">
                        {contact.firstName || contact.lastName
                          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                          : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">{maskPhone(contact.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <SubscriptionBadge isSubscribed={contact.isSubscribed} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary">
                        {contact.createdAt ? format(new Date(contact.createdAt), 'MMM d, yyyy') : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(contact)}
                          className="h-8 w-8 p-0"
                          aria-label="Edit contact"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(contact)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-500"
                          aria-label="Delete contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RetailCard>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {contacts.map((contact) => (
          <RetailCard key={contact.id} hover className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {contact.firstName || contact.lastName
                      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                      : '—'}
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">{maskPhone(contact.phone)}</p>
                </div>
                <SubscriptionBadge isSubscribed={contact.isSubscribed} />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
                {contact.createdAt && (
                  <span>Created: {format(new Date(contact.createdAt), 'MMM d, yyyy')}</span>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(contact)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirm(contact)}
                  className="flex-1 text-red-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </RetailCard>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            onDelete(deleteConfirm.id);
            setDeleteConfirm(null);
          }
        }}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
