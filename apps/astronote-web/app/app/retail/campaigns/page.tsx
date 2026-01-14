'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCampaigns } from '@/src/features/retail/campaigns/hooks/useCampaigns';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailDataTable } from '@/src/components/retail/RetailDataTable';
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
  const router = useRouter();
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

  const campaigns = data?.items || [];

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (campaign: any) => (
        <div className="text-sm font-medium text-text-primary">{campaign.name}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (campaign: any) => (
        <div className="space-y-1">
          <StatusBadge status={campaign.status} />
          {campaign.status === 'failed' && (
            <div className="text-xs text-red-400">
              Campaign failed. Create a new campaign or contact support.
            </div>
          )}
          {campaign.status === 'failed' && campaign.lastEnqueueError && (
            <div className="text-xs text-red-400/80">
              Last error: {campaign.lastEnqueueError}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'messages',
      header: 'Messages',
      render: (campaign: any) => (
        <div className="text-sm text-text-primary flex items-center gap-2 tabular-nums">
          <span className="font-medium text-green-500" title="Delivered (provider confirmed)">
            {(campaign.stats?.delivered ?? campaign.sent ?? campaign.stats?.sent ?? 0).toLocaleString()}
          </span>
          <span className="text-text-secondary">/</span>
          <span className="text-text-primary" title="Total recipients">
            {(campaign.total ?? campaign.stats?.total ?? 0).toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'Scheduled',
      render: (campaign: any) => (
        <div className="text-sm text-text-primary">
          {campaign.scheduledAt ? format(new Date(campaign.scheduledAt), 'MMM d, yyyy HH:mm') : '—'}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (campaign: any) => (
        <div className="text-sm text-text-secondary">
          {campaign.createdAt ? format(new Date(campaign.createdAt), 'MMM d, yyyy') : '—'}
        </div>
      ),
    },
  ];

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
            {campaigns.length > 0 ? (
              <>
                <RetailDataTable
                  data={campaigns}
                  keyExtractor={(c) => c.id}
                  columns={columns}
                  onRowClick={(c) => router.push(`/app/retail/campaigns/${c.id}`)}
                  mobileCardRender={(campaign: any) => (
                    <Link href={`/app/retail/campaigns/${campaign.id}`}>
                      <RetailCard hover className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="text-base font-semibold text-text-primary">{campaign.name}</h3>
                            <StatusBadge status={campaign.status} />
                          </div>
                          {(campaign.total || campaign.stats) && (
                            <div className="flex flex-wrap gap-2 text-sm">
                              <span className="text-text-secondary">
                                Recipients:{' '}
                                <span className="text-text-primary font-medium">
                                  {(campaign.total ?? campaign.stats?.total ?? 0)}
                                </span>
                              </span>
                              <span className="text-text-secondary">
                                Delivered:{' '}
                                <span className="text-green-400 font-medium">
                                  {(campaign.stats?.delivered ?? campaign.sent ?? campaign.stats?.sent ?? 0)}
                                </span>
                              </span>
                              {(campaign.stats?.pendingDelivery ?? 0) > 0 && (
                                <span className="text-amber-500">
                                  Pending delivery: {campaign.stats?.pendingDelivery ?? 0}
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
                          {campaign.status === 'failed' && (
                            <div className="text-xs text-red-400">
                              Campaign failed. Create a new campaign or contact support.
                              {campaign.lastEnqueueError && (
                                <div className="mt-1 text-red-400/80">
                                  Last error: {campaign.lastEnqueueError}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </RetailCard>
                    </Link>
                  )}
                />
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
