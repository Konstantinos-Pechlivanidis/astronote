import { useState } from 'react';
import { useShopifyContacts, useImportShopifyContacts } from '@/features/shopify/hooks/useShopifyContacts';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import ImportContactsDialog from '@/components/contacts/ImportContactsDialog';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import { formatDate } from '@/utils/formatters';
import { Upload } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { data, isLoading, error, refetch } = useShopifyContacts({ page, limit: 20, search });
  const importContacts = useImportShopifyContacts();

  const contacts = data?.contacts || data?.data?.contacts || [];
  const total = data?.total || data?.data?.total || 0;

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await importContacts.mutateAsync(formData);
      setImportDialogOpen(false);
    } catch (error) {
      // Error handled by mutation toast
    }
  };

  if (isLoading) {
    return <LoadingBlock message="Loading contacts..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load contacts"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  const columns = [
    { key: 'phone', label: 'Phone' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'status', label: 'Status' },
    { key: 'added', label: 'Added' },
  ];

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage your contact list"
        action={() => setImportDialogOpen(true)}
        actionLabel={
          <>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </>
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Reset to first page on search
          }}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={contacts}
        isLoading={isLoading}
        emptyTitle="No contacts found"
        emptyDescription="Import contacts via CSV to get started"
        emptyAction={() => setImportDialogOpen(true)}
        emptyActionLabel="Import CSV"
        page={page}
        pageSize={20}
        total={total}
        onPageChange={setPage}
        renderRow={(contact) => (
          <TableRow key={contact.id}>
            <TableCell className="font-medium">{contact.phoneE164}</TableCell>
            <TableCell>{contact.firstName || '-'}</TableCell>
            <TableCell>{contact.lastName || '-'}</TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  contact.smsConsent === 'opted_in'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {contact.smsConsent || 'unknown'}
              </span>
            </TableCell>
            <TableCell>{formatDate(contact.createdAt)}</TableCell>
          </TableRow>
        )}
      />

      <ImportContactsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
        isLoading={importContacts.isPending}
      />
    </div>
  );
}

