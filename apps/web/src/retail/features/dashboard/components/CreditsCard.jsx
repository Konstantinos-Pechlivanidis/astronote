import { CreditCard, CheckCircle, XCircle } from 'lucide-react';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';
import { useBalance } from '../hooks/useBalance';

export default function CreditsCard() {
  const { data, isLoading, error, refetch } = useBalance();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
        <div className="h-8 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-40 animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Credits & Subscription</h3>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const balance = data?.credits || 0; // Use normalized credits field
  const subscription = data?.subscription || { active: false, planType: null };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Credits & Subscription</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Available Credits</p>
          <p className="text-3xl font-bold text-gray-900">{balance.toLocaleString()}</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Subscription Status</p>
              <div className="flex items-center gap-2">
                {subscription.active ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Active</span>
                    {subscription.planType && (
                      <span className="text-sm text-gray-600 capitalize">({subscription.planType})</span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-medium text-red-600">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

