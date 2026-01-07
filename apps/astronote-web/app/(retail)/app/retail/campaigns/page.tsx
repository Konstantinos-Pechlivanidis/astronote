'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCampaigns } from '@/src/features/retail/campaigns/hooks/useCampaigns';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';

function CampaignsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string
  onSearchChange: (_value: string) => void
  statusFilter: string
  onStatusFilterChange: (_value: string) => void
}) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary pointer-events-none" />
        <Input
          type="text"
          placeholder="Search campaigns..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10 w-full"
        />
      </div>
      <div className="w-full sm:w-auto">
        <Select
          value={statusFilter}
          onValueChange={onStatusFilterChange}
        >
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CampaignsTable({ campaigns }: { campaigns: any[] }) {
  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <RetailCard>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => (window.location.href = `/app/retail/campaigns/${campaign.id}`)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text-primary">{campaign.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary flex items-center gap-2 tabular-nums">
                        <span className="font-medium text-green-500">{(campaign.sent ?? campaign.stats?.sent ?? 0).toLocaleString()}</span>
                        <span className="text-text-secondary">/</span>
                        <span className="text-text-primary">{(campaign.total ?? campaign.stats?.total ?? 0).toLocaleString()}</span>
                      </div>
                      {((campaign.failed ?? campaign.stats?.failed) ?? 0) > 0 && (
                        <div className="text-xs text-red-400 mt-1">
                          Failed: {(campaign.failed ?? campaign.stats?.failed ?? 0).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">
                        {campaign.scheduledAt
                          ? format(new Date(campaign.scheduledAt), 'MMM d, yyyy HH:mm')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary">
                        {campaign.createdAt ? format(new Date(campaign.createdAt), 'MMM d, yyyy') : '—'}
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
      <div className="space-y-4 md:hidden">
        {campaigns.map((campaign) => (
          <Link key={campaign.id} href={`/app/retail/campaigns/${campaign.id}`}>
            <RetailCard hover className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-semibold text-text-primary">{campaign.name}</h3>
                  <StatusBadge status={campaign.status} />
                </div>
                {(campaign.total || campaign.stats) && (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="text-text-secondary">
                      Recipients: <span className="text-text-primary font-medium">{(campaign.total ?? campaign.stats?.total ?? 0)}</span>
                    </span>
                    <span className="text-text-secondary">
                      Delivered: <span className="text-green-400 font-medium">{(campaign.sent ?? campaign.stats?.sent ?? 0)}</span>
                    </span>
                    {((campaign.failed ?? campaign.stats?.failed) ?? 0) > 0 && (
                      <span className="text-red-400">Failed: {(campaign.failed ?? campaign.stats?.failed ?? 0)}</span>
                    )}
                    {((campaign.total ?? campaign.stats?.total ?? 0) - ((campaign.sent ?? campaign.stats?.sent ?? 0) + (campaign.failed ?? campaign.stats?.failed ?? 0))) > 0 && (
                      <span className="text-amber-500">
                        Pending: {(campaign.total ?? campaign.stats?.total ?? 0) - ((campaign.sent ?? campaign.stats?.sent ?? 0) + (campaign.failed ?? campaign.stats?.failed ?? 0))}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-col gap-1 text-xs text-text-secondary">
                  {campaign.scheduledAt && (
                    <div>Scheduled: {format(new Date(campaign.scheduledAt), 'MMM d, yyyy HH:mm')}</div>
                  )}
                  {campaign.createdAt && (
                    <div>Created: {format(new Date(campaign.createdAt), 'MMM d, yyyy')}</div>
                  )}
                </div>
              </div>
            </RetailCard>
          </Link>
        ))}
      </div>
    </>
  );
}

function CampaignSkeleton() {
  return (
    <RetailCard>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-surface-light"></div>
        ))}
      </div>
    </RetailCard>
  );
}

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const pageSize = 20;

  const { data, isLoading, error, refetch } = useCampaigns({
    page,
    pageSize,
    q: search,
    status: statusFilter === 'all' ? null : statusFilter,
  });

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Campaigns"
          description="Create and manage your SMS campaigns"
          actions={
            <Link href="/app/retail/campaigns/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </Link>
          }
        />

        <CampaignsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {isLoading && <CampaignSkeleton />}

        {error && (
          <RetailCard variant="danger">
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">Error loading campaigns</p>
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
                <CampaignsTable campaigns={data.items} />
                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-text-secondary">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                    {data.total} campaigns
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
                  icon={Megaphone}
                  title={search || statusFilter !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
                  description={
                    search || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Create your first campaign to start sending SMS messages to your customers.'
                  }
                  action={
                    !search && statusFilter === 'all' && (
                      <Link href="/app/retail/campaigns/new">
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Campaign
                        </Button>
                      </Link>
                    )
                  }
                />
              </RetailCard>
            )}
          </>
        )}
      </div>
    </RetailPageLayout>
  );
}
