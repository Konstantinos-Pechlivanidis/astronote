import { Target, TrendingUp, Users, XCircle } from 'lucide-react';
import KpiCard from '../../dashboard/components/KpiCard';

export default function CampaignStatsCards({ stats }) {
  if (!stats) return null;

  const conversionRate = stats.sent > 0 ? (stats.conversions / stats.sent) * 100 : 0;
  const unsubscribeRate = stats.sent > 0 ? (stats.unsubscribes / stats.sent) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard
        title="Total Messages"
        value={stats.total?.toLocaleString() || 0}
        subtitle="All recipients"
        icon={Users}
      />
      <KpiCard
        title="Sent"
        value={stats.sent?.toLocaleString() || 0}
        subtitle={`${stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : 0}% success rate`}
        icon={TrendingUp}
      />
      <KpiCard
        title="Conversions"
        value={stats.conversions?.toLocaleString() || 0}
        subtitle={`${conversionRate.toFixed(1)}% conversion rate`}
        icon={Target}
      />
      <KpiCard
        title="Unsubscribes"
        value={stats.unsubscribes?.toLocaleString() || 0}
        subtitle={`${unsubscribeRate.toFixed(1)}% unsubscribe rate`}
        icon={XCircle}
      />
    </div>
  );
}

