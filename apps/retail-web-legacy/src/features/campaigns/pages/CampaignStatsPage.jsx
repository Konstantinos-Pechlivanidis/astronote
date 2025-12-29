import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import CampaignStatsCards from '../components/CampaignStatsCards';
import { useCampaignStats } from '../hooks/useCampaignStats';
import { ArrowLeft } from 'lucide-react';

export default function CampaignStatsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: stats, isLoading, error, refetch } = useCampaignStats(Number(id));

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Campaign Statistics" subtitle="Loading..." />
        <LoadingState message="Loading campaign statistics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Campaign Statistics" subtitle="Error loading stats" />
        <ErrorState error={error} onRetry={refetch} />
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
        title="Campaign Statistics"
        subtitle="Performance metrics and analytics"
      />

      <div className="mt-6">
        <CampaignStatsCards stats={stats} />
      </div>
    </div>
  );
}

