import { useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import ContactsToolbar from '../components/ContactsToolbar';
import ContactsTable from '../components/ContactsTable';
import ContactFormModal from '../components/ContactFormModal';
import ContactsSkeleton from '../components/ContactsSkeleton';
import { useContacts } from '../hooks/useContacts';
import { useSystemLists } from '../hooks/useSystemLists';
import { useCreateContact } from '../hooks/useCreateContact';
import { useUpdateContact } from '../hooks/useUpdateContact';
import { useDeleteContact } from '../hooks/useDeleteContact';
import { Users, Plus } from 'lucide-react';

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listId, setListId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

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
  const handleListChange = (newListId) => {
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

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleFormSubmit = (data) => {
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
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Manage your customer contacts"
      />

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
        <ErrorState
          error={error}
          onRetry={refetch}
        />
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
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                  {data.total} contacts
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= data.total}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
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
                    <button
                      onClick={handleAddClick}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Contact
                    </button>
                  )
                }
              />
            </div>
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
