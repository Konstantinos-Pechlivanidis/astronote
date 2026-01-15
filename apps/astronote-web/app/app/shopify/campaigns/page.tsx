'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCampaigns } from '@/src/features/shopify/campaigns/hooks/useCampaigns';
import { useCampaignStats } from '@/src/features/shopify/campaigns/hooks/useCampaignStats';
import { useDeleteCampaign, useEnqueueCampaign } from '@/src/features/shopify/campaigns/hooks/useCampaignMutations';
import { useSubscriptionStatus } from '@/src/features/shopify/billing/hooks/useSubscriptionStatus';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { AppPageHeader } from '@/src/components/app/AppPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailDataTable } from '@/src/components/retail/RetailDataTable';
import { CampaignStatusBadge } from '@/src/components/shopify/CampaignStatusBadge';
import { RetailLoadingSkeleton } from '@/src/components/retail/RetailLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { Megaphone, Plus, Search, Send, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Campaign } from '@/src/lib/shopify/api/campaigns';

// Sentinel value for "All" filter (must be non-empty for Radix Select)
const UI_ALL = '__all__';

/**
 * Campaign Skeleton Component
 */
function CampaignSkeleton() {
  return <RetailLoadingSkeleton asTable tableColumns={6} rows={6} />;
}

/**
 * Stats Cards Component
 */
function StatsCards({ stats }: { stats: any }) {
  // Backend returns the stats object directly (Shopify axios extracts `response.data.data`).
  // Keep backward compatibility with any older shape that nested under `stats`.
  const statsData = stats?.byStatus ? stats : (stats?.stats || {});
  const byStatus = statsData.byStatus || {};

  const statItems = [
    { label: 'Total', value: statsData.totalCampaigns ?? statsData.total ?? 0, color: 'text-text-primary' },
    { label: 'Draft', value: byStatus.draft || 0, color: 'text-text-secondary' },
    { label: 'Scheduled', value: byStatus.scheduled || 0, color: 'text-blue-400' },
    { label: 'Sending', value: byStatus.sending || 0, color: 'text-yellow-400' },
    { label: 'Completed', value: (byStatus.completed ?? byStatus.sent) || 0, color: 'text-green-400' },
    { label: 'Failed', value: byStatus.failed || 0, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {statItems.map((stat) => (
        <RetailCard key={stat.label} className="p-4">
          <div className="text-sm font-medium text-text-secondary mb-1">{stat.label}</div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
        </RetailCard>
      ))}
    </div>
  );
}

/**
 * Campaigns Toolbar Component
 */
function CampaignsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: {
  search: string;
  onSearchChange: (_value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (_value: string) => void;
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
            <SelectItem value={UI_ALL}>All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Campaigns List Page
 */
export default function CampaignsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(UI_ALL);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [sendTarget, setSendTarget] = useState<{ id: string; name: string } | null>(null);
  const [activePoll, setActivePoll] = useState(false);
  const pageSize = 20;

  // Fetch campaigns
  const {
    data: campaignsData,
    error: campaignsError,
    isLoading: campaignsLoading,
    refetch: refetchCampaigns,
  } = useCampaigns({
    page,
    pageSize,
    status: (statusFilter === UI_ALL ? undefined : statusFilter) as Campaign['status'] | undefined,
    search: search || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  }, {
    refetchInterval: activePoll ? 2 * 1000 : false,
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useCampaignStats({
    refetchInterval: activePoll ? 2 * 1000 : false,
  });
  const { data: subscriptionData } = useSubscriptionStatus();

  // Mutations
  const deleteCampaign = useDeleteCampaign();
  const enqueueCampaign = useEnqueueCampaign();

  const campaigns = useMemo(() => campaignsData?.campaigns || [], [campaignsData?.campaigns]);
  const pagination = useMemo(() => campaignsData?.pagination || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  }, [campaignsData?.pagination]);
  const isSubscriptionActive = subscriptionData?.status === 'active' || subscriptionData?.active === true;

  // Enable aggressive polling only while any campaign is actively sending/scheduled.
  useEffect(() => {
    const hasActive = campaigns.some((c) => c.status === 'sending' || c.status === 'scheduled');
    if (hasActive !== activePoll) setActivePoll(hasActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCampaign.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleSend = async () => {
    if (!sendTarget) return;
    try {
      await enqueueCampaign.mutateAsync(sendTarget.id);
      setSendTarget(null);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Table columns
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (campaign: Campaign) => (
        <div className="text-sm font-medium text-text-primary">{campaign.name}</div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (campaign: Campaign) => <CampaignStatusBadge status={campaign.status} />,
    },
    {
      key: 'recipients',
      header: 'Messages',
      render: (campaign: Campaign) => (
        <div className="text-sm text-text-primary flex items-center gap-2 tabular-nums">
          <span
            className="font-medium text-blue-400"
            title="Accepted by provider (Mitto messageId created)"
          >
            {(campaign.totals?.accepted ?? campaign.sentCount ?? 0).toLocaleString()}
          </span>
          <span className="text-text-secondary">/</span>
          <span className="text-text-primary" title="Total recipients">
            {(campaign.totals?.recipients ?? campaign.recipientCount ?? campaign.totalRecipients ?? 0).toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      key: 'scheduled',
      header: 'Scheduled',
      render: (campaign: Campaign) => (
        <div className="text-sm text-text-primary">
          {campaign.scheduleAt
            ? format(new Date(campaign.scheduleAt), 'MMM d, yyyy HH:mm')
            : '—'}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (campaign: Campaign) => (
        <div className="text-sm text-text-secondary">
          {campaign.createdAt
            ? format(new Date(campaign.createdAt), 'MMM d, yyyy')
            : '—'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (campaign: Campaign) => {
        const canSend = ['draft', 'scheduled', 'cancelled'].includes(campaign.status);
        const sendDisabled = !isSubscriptionActive || enqueueCampaign.isPending;
        return (
          <div className="flex items-center gap-2">
            {canSend && (
              <Button
                variant="ghost"
                size="sm"
                disabled={sendDisabled}
                title={!isSubscriptionActive ? 'Active subscription required to send campaigns' : 'Send campaign'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSubscriptionActive) {
                    return;
                  }
                  setSendTarget({ id: campaign.id, name: campaign.name });
                }}
                className="h-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget({ id: campaign.id, name: campaign.name });
              }}
              className="h-8 text-red-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // Mobile card render
  const mobileCardRender = (campaign: Campaign) => (
    <Link href={`/app/shopify/campaigns/${campaign.id}`}>
      <RetailCard hover className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-semibold text-text-primary">{campaign.name}</h3>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-text-secondary">
              Recipients: <span className="text-text-primary font-medium">
                {(campaign.totals?.recipients ?? campaign.recipientCount ?? campaign.totalRecipients ?? 0).toLocaleString()}
              </span>
            </span>
            {(campaign.totals?.accepted ?? campaign.sentCount ?? 0) > 0 && (
              <span className="text-text-secondary">
                Accepted: <span className="text-blue-400 font-medium">
                  {(campaign.totals?.accepted ?? campaign.sentCount ?? 0).toLocaleString()}
                </span>
              </span>
            )}
            {(campaign.totals?.failed ?? campaign.failedCount ?? 0) > 0 && (
              <span className="text-red-400">
                Failed: {(campaign.totals?.failed ?? campaign.failedCount ?? 0).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-text-secondary">
            {campaign.scheduleAt && (
              <div>Scheduled: {format(new Date(campaign.scheduleAt), 'MMM d, yyyy HH:mm')}</div>
            )}
            {campaign.createdAt && (
              <div>Created: {format(new Date(campaign.createdAt), 'MMM d, yyyy')}</div>
            )}
          </div>
        </div>
      </RetailCard>
    </Link>
  );

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <AppPageHeader
          title="Campaigns"
          description="Create and manage your SMS campaigns"
          actions={
            <Link href="/app/shopify/campaigns/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </Link>
          }
        />

        {/* Stats Cards */}
        {!statsLoading && statsData && <StatsCards stats={statsData} />}

        {/* Toolbar */}
        <div>
          <CampaignsToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={(value) => {
            // Store sentinel value in state (UI needs non-empty value)
              setStatusFilter(value);
            }}
          />
        </div>

        {/* Loading State */}
        {campaignsLoading && <CampaignSkeleton />}

        {/* Campaigns Table */}
        {!campaignsLoading && (
          <div>
            <RetailDataTable
              columns={columns}
              data={campaigns}
              keyExtractor={(campaign) => campaign.id}
              emptyTitle={search || statusFilter ? 'No campaigns found' : 'No campaigns yet'}
              emptyDescription={
                search || (statusFilter !== UI_ALL && statusFilter)
                  ? 'Try adjusting your filters'
                  : 'Create your first campaign to start sending SMS messages to your customers.'
              }
              emptyIcon={Megaphone}
              emptyAction={
                !search && !statusFilter && (
                  <Link href="/app/shopify/campaigns/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                    </Button>
                  </Link>
                )
              }
              error={campaignsError ? 'Failed to load campaigns' : undefined}
              onRetry={refetchCampaigns}
              mobileCardRender={mobileCardRender}
              onRowClick={(campaign) => router.push(`/app/shopify/campaigns/${campaign.id}`)}
            />
          </div>
        )}

        {/* Pagination */}
        {campaigns.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-secondary">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} campaigns
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
              </Button>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.hasNextPage}
                variant="outline"
                size="sm"
              >
              Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Campaign"
          message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />

        {/* Send Confirmation Dialog */}
        <ConfirmDialog
          open={!!sendTarget}
          onClose={() => setSendTarget(null)}
          onConfirm={handleSend}
          title="Send Campaign"
          message={`Are you sure you want to send "${sendTarget?.name}"? This will start sending SMS messages immediately.`}
          confirmText="Send"
          cancelText="Cancel"
        />
      </div>
    </RetailPageLayout>
  );
}
