'use client';

import { useState, useEffect } from 'react';
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
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { usePublicLinks, useRotatePublicLinks } from '@/src/features/retail/contacts/hooks/usePublicLinks';
import type { Contact } from '@/src/lib/retail/api/contacts';
import type { z } from 'zod';
import { contactSchema } from '@/src/lib/retail/validators';

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listId, setListId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

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
  const { data: publicLinks, refetch: refetchPublicLinks } = usePublicLinks();
  const rotatePublicLinks = useRotatePublicLinks();

  useEffect(() => {
    if (rotatePublicLinks.isSuccess) {
      refetchPublicLinks();
    }
  }, [rotatePublicLinks.isSuccess, refetchPublicLinks]);

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
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Contacts"
          description="Manage your customer contacts"
          actions={
            <Button onClick={handleAddClick} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          }
        />

        <ContactsToolbar
          search={search}
          onSearchChange={setSearch}
          onAddClick={handleAddClick}
          onOpenJoin={() => setJoinOpen(true)}
          listId={listId}
          onListChange={handleListChange}
          systemLists={systemLists}
          isLoadingLists={isLoadingLists}
        />

        {isLoading && <ContactsSkeleton />}

        {error && (
          <RetailCard variant="danger">
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">Error loading contacts</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
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
              <RetailCard>
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
                        <Plus className="mr-2 w-4 h-4" />
                        Add Contact
                      </Button>
                    )
                  }
                />
              </RetailCard>
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

        {joinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <RetailCard className="max-w-lg w-full space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">NFC / Share link</h3>
                  <p className="text-sm text-text-secondary">Share this link or print the QR.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setJoinOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="rounded-md border border-border bg-surface-light p-3 text-sm break-all">
                {publicLinks?.joinUrl || 'Generating...'}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (publicLinks?.joinUrl) navigator.clipboard?.writeText(publicLinks.joinUrl);
                  }}
                >
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (publicLinks?.joinUrl) window.open(publicLinks.joinUrl, '_blank');
                  }}
                >
                  Open
                </Button>
              </div>
              <div className="flex justify-center">
                {publicLinks?.joinUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicLinks.joinUrl)}`}
                    alt="Join QR"
                    className="w-44 h-44 border border-border rounded bg-white"
                  />
                ) : (
                  <div className="w-44 h-44 bg-surface-light border border-border rounded animate-pulse" />
                )}
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rotatePublicLinks.isPending}
                  onClick={() => rotatePublicLinks.mutate()}
                >
                  Rotate link
                </Button>
                <Button size="sm" variant="outline" onClick={() => refetchPublicLinks()}>
                  Refresh
                </Button>
              </div>
            </RetailCard>
          </div>
        )}
      </div>
    </RetailPageLayout>
  );
}
