import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import StatusBadge from '../../../components/common/StatusBadge';
import CampaignActions from '../components/CampaignActions';
import MessagePreviewModal from '../components/MessagePreviewModal';
import { useCampaign } from '../hooks/useCampaign';
import { useCampaignPreview } from '../hooks/useCampaignPreview';
import { useState } from 'react';

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: campaign, isLoading, error, refetch } = useCampaign(Number(id));
  const { data: previewData, isLoading: previewLoading } = useCampaignPreview(Number(id));

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Campaign" subtitle="Loading..." />
        <LoadingState message="Loading campaign details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Campaign" subtitle="Error loading campaign" />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <PageHeader title="Campaign" subtitle="Campaign not found" />
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Campaign not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={campaign.name}
        subtitle={`Created ${campaign.createdAt ? format(new Date(campaign.createdAt), 'PPpp') : '—'}`}
      />

      <div className="space-y-6">
        {/* Campaign Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Campaign Details</h2>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Total Recipients</span>
              <div className="text-lg font-medium text-gray-900">{campaign.total || 0}</div>
            </div>
            {campaign.scheduledAt && (
              <div>
                <span className="text-sm text-gray-600">Scheduled For</span>
                <div className="text-lg font-medium text-gray-900">
                  {format(new Date(campaign.scheduledAt), 'PPpp')}
                </div>
              </div>
            )}
            {campaign.startedAt && (
              <div>
                <span className="text-sm text-gray-600">Started At</span>
                <div className="text-lg font-medium text-gray-900">
                  {format(new Date(campaign.startedAt), 'PPpp')}
                </div>
              </div>
            )}
            {campaign.finishedAt && (
              <div>
                <span className="text-sm text-gray-600">Finished At</span>
                <div className="text-lg font-medium text-gray-900">
                  {format(new Date(campaign.finishedAt), 'PPpp')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Preview */}
        {campaign.messageText && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Message</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{campaign.messageText}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Gender</span>
              <div className="text-lg font-medium text-gray-900 capitalize">
                {campaign.filterGender || 'Any'}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Age Group</span>
              <div className="text-lg font-medium text-gray-900">
                {campaign.filterAgeGroup || 'Any'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
          <CampaignActions
            campaign={campaign}
            onPreviewMessages={() => setPreviewOpen(true)}
            onViewStatus={() => navigate(`/app/campaigns/${id}/status`)}
            onViewStats={() => navigate(`/app/campaigns/${id}/stats`)}
          />
        </div>
      </div>

      <MessagePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        messages={previewData?.sample || []}
        isLoading={previewLoading}
      />
    </div>
  );
}

