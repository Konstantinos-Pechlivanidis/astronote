import { useShopifyDashboard } from '@/features/shopify/hooks/useShopifyDashboard';
import ReportsWidgets from '@/components/dashboard/ReportsWidgets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import { formatNumber } from '@/utils/formatters';

export default function DashboardPage() {
  const { data: dashboard, isLoading, error, refetch } = useShopifyDashboard();

  if (isLoading) {
    return <LoadingBlock message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  const kpis = dashboard?.kpis || {};
  const credits = dashboard?.credits || {};
  const reports = dashboard?.reports || {};

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your SMS marketing performance" />
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Credits Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(credits.balance || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Available credits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpis.totalContacts || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">In your database</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpis.activeCampaigns || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Currently sending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Automations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpis.activeAutomations || 0)}</div>
            <p className="text-xs text-gray-500 mt-1">Enabled triggers</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Widgets - Embedded in Dashboard (NO /reports page) */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Reports</h2>
        <ReportsWidgets reports={reports} />
      </div>
    </div>
  );
}

