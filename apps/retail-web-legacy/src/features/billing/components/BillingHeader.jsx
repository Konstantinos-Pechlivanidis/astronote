import StatusBadge from '../../../components/common/StatusBadge';

export default function BillingHeader({ subscription, credits }) {
  const isActive = subscription?.active === true;
  const planType = subscription?.planType;
  const intervalLabel = subscription?.interval === 'year'
    ? 'Yearly'
    : subscription?.interval === 'month'
      ? 'Monthly'
      : null;
  const planLabel = planType
    ? planType.charAt(0).toUpperCase() + planType.slice(1)
    : intervalLabel
      ? `${intervalLabel} Plan`
      : 'Plan';
  const nextRenewal = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Billing & Subscription</h2>
        <StatusBadge
          status={isActive ? 'active' : 'inactive'}
          label={isActive ? `Active ${intervalLabel || planType || ''} Plan` : 'Inactive'}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <span className="text-sm text-gray-600">Credits Balance</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {credits?.toLocaleString() || 0} credits
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Current Plan</span>
          <div className="text-lg font-medium text-gray-900 mt-1">{planLabel}</div>
          <div className={`text-xs mt-1 ${isActive ? 'text-green-600' : 'text-red-600'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Next Renewal</span>
          <div className="text-lg font-medium text-gray-900 mt-1">
            {nextRenewal || '—'}
          </div>
        </div>
      </div>
      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p className="text-sm text-yellow-800">
          Credits accumulate and never expire; spending requires an active subscription.
        </p>
      </div>
    </div>
  );
}
