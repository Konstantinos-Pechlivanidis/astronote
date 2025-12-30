import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import CampaignsToolbar from '../components/CampaignsToolbar';
import CampaignsTable from '../components/CampaignsTable';
import CampaignSkeleton from '../components/CampaignSkeleton';
import { useCampaigns } from '../hooks/useCampaigns';
import { Megaphone, Plus } from 'lucide-react';

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
      <PageHeader title="Campaigns" subtitle="Create and manage your SMS campaigns" />

      <CampaignsToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {isLoading && <CampaignSkeleton />}

      {error && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !error && data && (
        <>
          {data.items && data.items.length > 0 ? (
            <>
              <CampaignsTable campaigns={data.items} />
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                  {data.total} campaigns
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
                icon={Megaphone}
                title={search || statusFilter !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
                description={
                  search || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first campaign to start sending SMS messages to your customers.'
                }
                action={
                  !search && statusFilter === 'all' && (
                    <Link
                      to="/app/campaigns/new"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Campaign
                    </Link>
                  )
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
