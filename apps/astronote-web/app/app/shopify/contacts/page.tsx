'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useContacts } from '@/src/features/shopify/contacts/hooks/useContacts';
import { useContactStats } from '@/src/features/shopify/contacts/hooks/useContactStats';
import { useDeleteContact } from '@/src/features/shopify/contacts/hooks/useContactMutations';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailDataTable } from '@/src/components/retail/RetailDataTable';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Pagination } from '@/src/components/app/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { Users, Upload, Search, Trash2, AlertCircle, Download, CheckSquare, Square } from 'lucide-react';
import type { Contact } from '@/src/lib/shopify/api/contacts';
import { getIntParam, setQueryParams } from '@/src/lib/url/query';

// Sentinel value for "All" filter (must be non-empty for Radix Select)
const UI_ALL = '__all__';

/**
 * Contacts List Page
 */
export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = getIntParam(searchParams.get('page'), 1);
  const pageSize = getIntParam(searchParams.get('pageSize'), 20);
  const consentFilter = searchParams.get('consent') || UI_ALL;

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateUrl = (updates: Record<string, string | number | null | undefined>) => {
    router.replace(setQueryParams(searchParams, updates), { scroll: false });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      updateUrl({ q: searchQuery || null, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Fetch contacts
  const {
    data: contactsData,
    isLoading: contactsLoading,
    error: contactsError,
    refetch: refetchContacts,
  } = useContacts({
    page,
    pageSize,
    q: debouncedSearch || undefined,
    smsConsent: (consentFilter === UI_ALL ? undefined : consentFilter) as 'unknown' | 'opted_in' | 'opted_out' | undefined,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useContactStats();

  // Delete mutation
  const deleteContact = useDeleteContact();

  // Support both Retail-aligned "items" and Shopify "contacts" field names
  const contacts = contactsData?.items || contactsData?.contacts || [];
  const pagination = contactsData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContact.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    try {
      // Delete all selected contacts sequentially
      const deletePromises = Array.from(selectedContacts).map((id) =>
        deleteContact.mutateAsync(id),
      );
      await Promise.all(deletePromises);
      setSelectedContacts(new Set());
      setShowBulkDeleteDialog(false);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Select all functionality moved to header button in columns definition

  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const handleExport = () => {
    // Get all contacts (including filtered ones)
    const contactsToExport = contacts;

    // Create CSV content
    const headers = ['Phone', 'First Name', 'Last Name', 'Email', 'Gender', 'Birth Date', 'SMS Consent', 'Created At'];
    const rows = contactsToExport.map((contact) => [
      contact.phoneE164 || '',
      contact.firstName || '',
      contact.lastName || '',
      contact.email || '',
      contact.gender || '',
      contact.birthDate ? new Date(contact.birthDate).toLocaleDateString() : '',
      contact.smsConsent || 'unknown',
      contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '',
    ]);

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contacts-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats cards
  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'Total',
        value: stats.total || 0,
        icon: Users,
        variant: 'default' as const,
      },
      {
        label: 'Opted In',
        value: stats.optedIn || 0,
        icon: Users,
        variant: 'default' as const,
      },
      {
        label: 'Opted Out',
        value: stats.optedOut || 0,
        icon: Users,
        variant: 'default' as const,
      },
      {
        label: 'Pending',
        value: (stats.total || 0) - (stats.optedIn || 0) - (stats.optedOut || 0),
        icon: Users,
        variant: 'default' as const,
      },
    ];
  }, [stats]);

  // Table columns
  const columns = [
    {
      key: 'select',
      header: '',
      render: (contact: Contact) => (
        <button
          onClick={() => handleSelectContact(contact.id)}
          className="flex items-center justify-center"
          aria-label={`Select ${contact.firstName || contact.phoneE164}`}
        >
          {selectedContacts.has(contact.id) ? (
            <CheckSquare className="h-5 w-5 text-accent" />
          ) : (
            <Square className="h-5 w-5 text-text-tertiary" />
          )}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (contact: Contact) => {
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'N/A';
        return (
          <Link
            href={`/app/shopify/contacts/${contact.id}`}
            className="font-medium text-text-primary hover:text-accent"
          >
            {name}
          </Link>
        );
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (contact: Contact) => (
        <span className="text-text-primary">{contact.phoneE164}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (contact: Contact) => (
        <span className="text-text-secondary">{contact.email || '—'}</span>
      ),
    },
    {
      key: 'consent',
      header: 'Consent',
      render: (contact: Contact) => {
        const consent = contact.smsConsent || 'unknown';
        const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
          opted_in: { label: 'Opted In', variant: 'success' },
          opted_out: { label: 'Opted Out', variant: 'danger' },
          unknown: { label: 'Pending', variant: 'warning' },
        };
        const status = statusMap[consent] || statusMap.unknown;
        return <StatusBadge status={status.variant} label={status.label} />;
      },
    },
    {
      key: 'created',
      header: 'Created',
      render: (contact: Contact) => {
        if (!contact.createdAt) return <span className="text-text-tertiary">—</span>;
        const date = new Date(contact.createdAt);
        return (
          <span className="text-text-secondary text-sm">
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (contact: Contact) => {
        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phoneE164;
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget({ id: contact.id, name })}
            disabled={deleteContact.isPending}
            className="text-red-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        );
      },
    },
  ];

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <AppPageHeader
          title="Contacts"
          description="Manage your customer contacts"
          actions={
            <div className="flex items-center gap-2">
              {selectedContacts.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={contacts.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                  Export Selected ({selectedContacts.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    className="text-red-400 hover:text-red-500"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedContacts.size})
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={contacts.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
              Export All
              </Button>
              <Link href="/app/shopify/contacts/import">
                <Button size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                Import Contacts
                </Button>
              </Link>
              <Link href="/app/shopify/contacts/new">
                <Button size="sm">
                  <Users className="mr-2 h-4 w-4" />
                Add Contact
                </Button>
              </Link>
            </div>
          }
        />

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <RetailCard key={idx} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-text-secondary mb-1">{card.label}</div>
                      <div className="text-2xl font-bold text-text-primary">{card.value.toLocaleString()}</div>
                    </div>
                    <Icon className="h-8 w-8 text-text-tertiary" />
                  </div>
                </RetailCard>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        <RetailCard className="mb-6 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
              <Select
                value={consentFilter}
                onValueChange={(value) => updateUrl({ consent: value === UI_ALL ? null : value, page: 1 })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Consent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_ALL}>All Consent</SelectItem>
                  <SelectItem value="opted_in">Opted In</SelectItem>
                  <SelectItem value="opted_out">Opted Out</SelectItem>
                  <SelectItem value="unknown">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </RetailCard>

        {/* Loading State */}
        {contactsLoading && (
          <RetailCard className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 w-full animate-pulse rounded bg-surface-light" />
              ))}
            </div>
          </RetailCard>
        )}

        {/* Error State */}
        {contactsError && !contactsLoading && (
          <RetailCard variant="danger" className="p-6">
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to Load Contacts</h3>
              <p className="text-sm text-text-secondary mb-4">
                {contactsError instanceof Error
                  ? contactsError.message
                  : 'An error occurred while loading contacts.'}
              </p>
              <Button variant="outline" onClick={() => refetchContacts()}>
              Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Empty State */}
        {!contactsLoading && !contactsError && contacts.length === 0 && (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description={
              searchQuery || (consentFilter !== UI_ALL && consentFilter)
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by importing your contacts from a CSV file.'
            }
            action={
              !searchQuery && !consentFilter ? (
                <Link href="/app/shopify/contacts/import">
                  <Button>
                    <Upload className="mr-2 h-4 w-4" />
                  Import Contacts
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={() => {
                  setSearchQuery('');
                  updateUrl({ q: null, consent: null, page: 1 });
                }}>
                Clear Filters
                </Button>
              )
            }
          />
        )}

        {/* Contacts Table */}
        {!contactsLoading && !contactsError && contacts.length > 0 && (
          <>
            <RetailCard className="p-0 overflow-hidden">
              <RetailDataTable
                data={contacts}
                columns={columns}
                keyExtractor={(contact) => contact.id.toString()}
                mobileCardRender={(contact) => {
                  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'N/A';
                  const consent = contact.smsConsent || 'unknown';
                  const statusMap: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
                    opted_in: { label: 'Opted In', variant: 'success' },
                    opted_out: { label: 'Opted Out', variant: 'danger' },
                    unknown: { label: 'Pending', variant: 'warning' },
                  };
                  const status = statusMap[consent] || statusMap.unknown;
                  return (
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">{name}</span>
                        <StatusBadge status={status.variant} label={status.label} />
                      </div>
                      <div className="text-sm text-text-secondary">{contact.phoneE164}</div>
                      {contact.email && (
                        <div className="text-sm text-text-secondary">{contact.email}</div>
                      )}
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget({ id: contact.id, name })}
                          disabled={deleteContact.isPending}
                          className="text-red-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }}
              />
            </RetailCard>

            <div className="mt-6">
              <Pagination
                pagination={pagination}
                onPageChange={(p) => updateUrl({ page: p })}
                onPageSizeChange={(ps) => updateUrl({ pageSize: ps, page: 1 })}
                disabled={contactsLoading}
              />
            </div>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Contact"
          message={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />

        {/* Bulk Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showBulkDeleteDialog}
          onClose={() => setShowBulkDeleteDialog(false)}
          onConfirm={handleBulkDelete}
          title="Delete Selected Contacts"
          message={`Are you sure you want to delete ${selectedContacts.size} contact(s)? This action cannot be undone.`}
          confirmText="Delete All"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </RetailPageLayout>
  );
}
