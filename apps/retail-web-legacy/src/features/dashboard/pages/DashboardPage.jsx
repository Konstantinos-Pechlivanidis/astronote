import { useKPIs } from '../hooks/useKPIs';
import KpiCard from '../components/KpiCard';
import CreditsCard from '../components/CreditsCard';
import QuickActions from '../components/QuickActions';
import RecentCampaigns from '../components/RecentCampaigns';
import DashboardSkeleton from '../components/DashboardSkeleton';
import ErrorState from '../../../components/common/ErrorState';
import { Megaphone, MessageSquare, Send, XCircle, TrendingUp, Target } from 'lucide-react';

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKPIs } = useKPIs();

  if (kpisLoading) {
    return (
      <div>
        <DashboardSkeleton />
      </div>
    );
  }

  if (kpisError) {
    return (
      <div>
        <ErrorState error={kpisError} onRetry={refetchKPIs} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard
          title="Total Campaigns"
          value={kpis?.totalCampaigns || 0}
          subtitle="All time"
          icon={Megaphone}
        />
        <KpiCard
          title="Total Messages"
          value={kpis?.totalMessages || 0}
          subtitle="All time"
          icon={MessageSquare}
        />
        <KpiCard
          title="Messages Sent"
          value={kpis?.sent || 0}
          subtitle={`${kpis?.sentRate ? (kpis.sentRate * 100).toFixed(1) : 0}% success rate`}
          icon={Send}
        />
        <KpiCard
          title="Messages Failed"
          value={kpis?.failed || 0}
          subtitle="Failed deliveries"
          icon={XCircle}
        />
        <KpiCard
          title="Conversions"
          value={kpis?.conversion || 0}
          subtitle="Offer redemptions"
          icon={Target}
        />
        <KpiCard
          title="Conversion Rate"
          value={kpis?.conversionRate ? (kpis.conversionRate * 100).toFixed(1) : 0}
          subtitle="% of sent messages"
          icon={TrendingUp}
          trend={kpis?.conversionRate ? kpis.conversionRate * 100 : 0}
        />
      </div>

      {/* Credits & Subscription */}
      <CreditsCard />

      {/* Quick Actions */}
      <QuickActions />

      {/* Recent Campaigns */}
      <RecentCampaigns />
    </div>
  );
}

