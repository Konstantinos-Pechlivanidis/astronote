import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import StatusBadge from '../../../components/common/StatusBadge';
import EmptyState from '../../../components/common/EmptyState';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import { useRecentCampaigns } from '../hooks/useRecentCampaigns';
import { Megaphone } from 'lucide-react';

export default function RecentCampaigns() {
  const { data, isLoading, error, refetch } = useRecentCampaigns();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Campaigns</h3>
        <LoadingState message="Loading campaigns..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Campaigns</h3>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data || !data.items || data.items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Campaigns</h3>
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start reaching your customers."
          action={
            <Link
              to="/retail/campaigns/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
            >
              Create Campaign
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Campaigns</h3>
        <Link
          to="/retail/campaigns"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {data.items.map((campaign) => (
          <Link
            key={campaign.id}
            to={`/retail/campaigns/${campaign.id}`}
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                  <StatusBadge status={campaign.status} />
                </div>
                {campaign.stats && (
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Total: {campaign.stats.total || 0}</span>
                    <span>Sent: {campaign.stats.sent || 0}</span>
                    {campaign.stats.failed > 0 && (
                      <span className="text-red-600">Failed: {campaign.stats.failed}</span>
                    )}
                  </div>
                )}
                {campaign.createdAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

