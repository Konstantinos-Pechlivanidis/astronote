import PageHeader from '../../../components/common/PageHeader';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import ProfileCard from '../components/ProfileCard';
import SecurityCard from '../components/SecurityCard';
import BillingSummaryCard from '../components/BillingSummaryCard';
import { useMe } from '../api/settings.queries';

export default function SettingsPage() {
  const { data: user, isLoading, error, refetch } = useMe();

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, security, and preferences"
      />

      {isLoading && <LoadingState message="Loading settings..." />}

      {error && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* Account / Profile Section */}
          <ProfileCard user={user} isLoading={isLoading} />

          {/* Security Section */}
          <SecurityCard />

          {/* Billing Summary Section (Read-only) */}
          <BillingSummaryCard />
        </div>
      )}
    </div>
  );
}

