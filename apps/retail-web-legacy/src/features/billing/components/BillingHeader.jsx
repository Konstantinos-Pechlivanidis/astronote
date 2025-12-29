import StatusBadge from '../../../components/common/StatusBadge';

export default function BillingHeader({ subscription, credits }) {
  const isActive = subscription?.active === true;
  const planType = subscription?.planType;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Billing & Subscription</h2>
        <StatusBadge
          status={isActive ? 'active' : 'inactive'}
          label={isActive ? `Active ${planType || ''} Plan` : 'Inactive'}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-gray-600">Credits Balance</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {credits?.toLocaleString() || 0} credits
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Subscription Status</span>
          <div className="text-lg font-medium text-gray-900 mt-1">
            {isActive ? (
              <span className="text-green-600">Active {planType ? `(${planType})` : ''}</span>
            ) : (
              <span className="text-red-600">Inactive</span>
            )}
          </div>
        </div>
      </div>
      {!isActive && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Credits can be purchased at any time, but can only be <strong>used</strong> to send campaigns when you have an active subscription. Subscribe to a plan to start sending campaigns.
          </p>
        </div>
      )}
    </div>
  );
}

