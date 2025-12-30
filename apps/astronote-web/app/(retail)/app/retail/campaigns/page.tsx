'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCampaigns } from '@/src/features/retail/campaigns/hooks/useCampaigns';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-tertiary" />
        <Input
          type="text"
          placeholder="Search campaigns..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
        </Select>
        <Link href="/app/retail/campaigns/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CampaignsTable({ campaigns }: { campaigns: any[] }) {
  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  return (
    <GlassCard>
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
                className="hover:bg-surface cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-text-primary">{campaign.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {campaign.stats ? (
                    <div className="text-sm text-text-primary">
                      <span>Total: {campaign.stats.total || 0}</span>
                      {campaign.stats.sent > 0 && (
                        <span className="ml-2 text-green-400">Sent: {campaign.stats.sent}</span>
                      )}
                      {campaign.stats.failed > 0 && (
                        <span className="ml-2 text-red-400">Failed: {campaign.stats.failed}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-text-secondary">—</span>
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
    </GlassCard>
  );
}

function CampaignSkeleton() {
  return (
    <GlassCard>
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-surface-light rounded animate-pulse"></div>
        ))}
      </div>
    </GlassCard>
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Campaigns</h1>
        <p className="text-sm text-text-secondary mt-1">Create and manage your SMS campaigns</p>
      </div>

      <CampaignsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {isLoading && <CampaignSkeleton />}

      {error && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading campaigns</p>
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
            <GlassCard>
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
                        <Plus className="w-4 h-4 mr-2" />
                        Create Campaign
                      </Button>
                    </Link>
                  )
                }
              />
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

