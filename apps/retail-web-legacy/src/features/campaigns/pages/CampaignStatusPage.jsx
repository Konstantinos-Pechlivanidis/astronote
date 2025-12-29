import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import CampaignProgressCard from '../components/CampaignProgressCard';
import { useCampaignStatus } from '../hooks/useCampaignStatus';
import { ArrowLeft } from 'lucide-react';

export default function CampaignStatusPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useCampaignStatus(Number(id));

  if (isLoading && !data) {
    return (
      <div>
        <PageHeader title="Campaign Status" subtitle="Loading..." />
        <LoadingState message="Loading campaign status..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Campaign Status" subtitle="Error loading status" />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Campaign Status" subtitle="Status not found" />
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Status not found</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => navigate(`/app/campaigns/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaign
        </button>
      </div>
      <PageHeader
        title="Campaign Status"
        subtitle={`Real-time progress for ${data.campaign?.name || 'campaign'}`}
      />

      <div className="mt-6">
        <CampaignProgressCard campaign={data.campaign} metrics={data.metrics} />
      </div>
    </div>
  );
}

