import { CreditCard, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBillingGate } from '../../billing/hooks/useBillingGate';
import StatusBadge from '../../../components/common/StatusBadge';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';

export default function BillingSummaryCard() {
  const navigate = useNavigate();
  const billingGate = useBillingGate();

  if (billingGate.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Billing Status</h2>
        </div>
        <LoadingState message="Loading billing information..." />
      </div>
    );
  }

  if (billingGate.error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Billing Status</h2>
        </div>
        <ErrorState error={billingGate.error} />
      </div>
    );
  }

  const subscription = billingGate.subscription || { active: false, planType: null };
  const credits = billingGate.credits || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Billing Status</h2>
      </div>

      <div className="space-y-4">
        {/* Subscription Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Status</label>
          <div className="flex items-center gap-3">
            {subscription.active ? (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                Inactive
              </span>
            )}
            <span className="text-sm text-gray-600">
              {subscription.active
                ? subscription.planType
                  ? `${subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)} Plan`
                  : 'Active'
                : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Credits Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Credits Balance</label>
          <p className="text-lg font-semibold text-gray-900">{credits.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {subscription.active
              ? 'Credits can be used to send campaigns'
              : 'Active subscription required to use credits'}
          </p>
        </div>

        {/* CTA Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/app/billing')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Go to Billing
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

