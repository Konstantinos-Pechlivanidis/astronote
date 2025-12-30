'use client';

import { useState } from 'react';
import { Users, Plus } from 'lucide-react';
import { useContacts } from '@/src/features/retail/contacts/hooks/useContacts';
import { useSystemLists } from '@/src/features/retail/contacts/hooks/useSystemLists';
import { useCreateContact } from '@/src/features/retail/contacts/hooks/useCreateContact';
import { useUpdateContact } from '@/src/features/retail/contacts/hooks/useUpdateContact';
import { useDeleteContact } from '@/src/features/retail/contacts/hooks/useDeleteContact';
import { ContactsToolbar } from '@/src/components/retail/contacts/ContactsToolbar';
import { ContactsTable } from '@/src/components/retail/contacts/ContactsTable';
import { ContactFormModal } from '@/src/components/retail/contacts/ContactFormModal';
import { ContactsSkeleton } from '@/src/components/retail/contacts/ContactsSkeleton';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/src/lib/retail/api/contacts';
import type { z } from 'zod';
import { contactSchema } from '@/src/lib/retail/validators';

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listId, setListId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const pageSize = 20;

  // Fetch system lists for filter dropdown
  const { data: listsData, isLoading: isLoadingLists } = useSystemLists();
  const systemLists = listsData?.items || [];

  // Fetch contacts with optional list filter
  const { data, isLoading, error, refetch } = useContacts({
    page,
    pageSize,
    q: search,
    listId,
  });

  // Reset to page 1 when filter changes
  const handleListChange = (newListId: number | null) => {
    setListId(newListId);
    setPage(1);
  };

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const handleAddClick = () => {
    setEditingContact(null);
    setFormOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleFormSubmit = (data: z.infer<typeof contactSchema>) => {
    if (editingContact) {
      updateMutation.mutate(
        { id: editingContact.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingContact(null);
          },
        },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          setFormOpen(false);
        },
      });
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingContact(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Contacts</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your customer contacts</p>
        </div>
      </div>

      <ContactsToolbar
        search={search}
        onSearchChange={setSearch}
        onAddClick={handleAddClick}
        listId={listId}
        onListChange={handleListChange}
        systemLists={systemLists}
        isLoadingLists={isLoadingLists}
      />

      {isLoading && <ContactsSkeleton />}

      {error && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading contacts</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      )}

      {!isLoading && !error && data && (
        <>
          {data.items && data.items.length > 0 ? (
            <>
              <ContactsTable
                contacts={data.items}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                  {data.total} contacts
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= data.total}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <GlassCard>
              <EmptyState
                icon={Users}
                title={
                  listId
                    ? 'No contacts in this list'
                    : search
                      ? 'No contacts found'
                      : 'No contacts yet'
                }
                description={
                  listId
                    ? 'This list does not contain any contacts matching your criteria.'
                    : search
                      ? 'Try adjusting your search terms'
                      : 'Add your first contact to start building your customer database. Phone numbers must be in E.164 format (e.g., +306912345678).'
                }
                action={
                  !search && !listId && (
                    <Button onClick={handleAddClick} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  )
                }
              />
            </GlassCard>
          )}
        </>
      )}

      <ContactFormModal
        open={formOpen}
        onClose={handleCloseForm}
        contact={editingContact}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

