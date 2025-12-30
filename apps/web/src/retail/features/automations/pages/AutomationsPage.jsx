import PageHeader from '../../../components/common/PageHeader';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import AutomationsList from '../components/AutomationsList';
import AutomationsSkeleton from '../components/AutomationsSkeleton';
import { useAutomations } from '../api/automations.queries';
import { useBillingGate } from '../../billing/hooks/useBillingGate';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AutomationsPage() {
  const { data: automations, isLoading, error, refetch } = useAutomations();
  const billingGate = useBillingGate();

  return (
    <div>
      <PageHeader
        title="Automations"
        subtitle="Automatically send welcome and birthday messages to your contacts"
      />

      {/* Billing Gate Banner */}
      {!billingGate.isLoading && !billingGate.canSendCampaigns && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Subscription required:</strong> Active subscription is required to enable automations.{' '}
                <Link to="/app/billing" className="underline font-medium">
                  Go to Billing
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading && <AutomationsSkeleton />}

      {error && <ErrorState error={error} onRetry={refetch} />}

      {!isLoading && !error && automations && (
        <AutomationsList automations={automations} />
      )}
    </div>
  );
}

