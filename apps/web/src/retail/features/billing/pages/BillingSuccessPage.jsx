import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '../../../components/common/PageHeader';
import { billingApi } from '../../../api/modules/billing';
import { CheckCircle, RefreshCw, AlertCircle, CreditCard } from 'lucide-react';
import { queryKeys } from '../../../lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 10; // 20 seconds total
const POLL_TIMEOUT = MAX_POLL_ATTEMPTS * POLL_INTERVAL;

export default function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionId = searchParams.get('session_id');

  const [walletData, setWalletData] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Fetch wallet data
  const fetchWallet = async () => {
    try {
      const res = await billingApi.getWallet();
      const data = res.data;
      setWalletData(data);
      setLastUpdateTime(new Date());
      setError(null);

      // Invalidate React Query cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.balance });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.wallet });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.packages });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.transactions });

      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  // Manual sync function
  const handleSync = async () => {
    setIsPolling(true);
    setPollAttempts(0);
    setError(null);
    try {
      await fetchWallet();
      toast.success('Billing status synced');
    } catch (err) {
      toast.error('Failed to sync billing status');
    } finally {
      setIsPolling(false);
    }
  };

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    // Initial fetch
    fetchWallet().catch(() => {
      // Error handled in state
    });

    // Set up polling interval
    const intervalId = setInterval(async () => {
      setPollAttempts((prev) => {
        const next = prev + 1;

        if (next >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false);
          clearInterval(intervalId);
          return next;
        }

        // Fetch wallet data
        fetchWallet().catch(() => {
          // Error handled in state
        });

        return next;
      });
    }, POLL_INTERVAL);

    // Cleanup
    return () => clearInterval(intervalId);
  }, [isPolling]);

  // Determine if payment was successful based on wallet data
  const subscriptionActive = walletData?.subscription?.active || false;
  const credits = walletData?.credits || 0; // Use normalized credits field
  const hasUpdated = walletData && (subscriptionActive || credits > 0);

  return (
    <div>
      <PageHeader
        title="Payment Processing"
        subtitle="We're updating your billing information..."
      />

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
        {isPolling && pollAttempts === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Processing Payment...
            </h3>
            <p className="text-sm text-gray-600">
              Please wait while we verify your payment and update your account.
            </p>
          </div>
        )}

        {isPolling && pollAttempts > 0 && pollAttempts < MAX_POLL_ATTEMPTS && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Still Processing...
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Payment verification may take a few seconds. Checking again... ({pollAttempts}/{MAX_POLL_ATTEMPTS})
            </p>
            {walletData && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Current Status:</p>
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Credits:</span>
                    <span className="ml-2 font-semibold text-gray-900">{credits.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Subscription:</span>
                    <span className={`ml-2 font-semibold ${subscriptionActive ? 'text-green-600' : 'text-gray-600'}`}>
                      {subscriptionActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isPolling && hasUpdated && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Payment Successful!
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Your payment has been processed and your account has been updated.
            </p>
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Credits:</span>
                  <span className="text-lg font-semibold text-gray-900">{credits.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Subscription:</span>
                  <span className={`text-sm font-semibold ${subscriptionActive ? 'text-green-600' : 'text-gray-600'}`}>
                    {subscriptionActive ? '✅ Active' : '❌ Inactive'}
                  </span>
                </div>
                {lastUpdateTime && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">Last updated:</span>
                    <span className="text-xs text-gray-500">
                      {lastUpdateTime.toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                to="/app/billing"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Go to Billing
              </Link>
              <Link
                to="/app/dashboard"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {!isPolling && !hasUpdated && !error && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Payment Processing Delayed
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Your payment may still be processing. This can take up to a few minutes.
              {walletData && (
                <span className="block mt-2">
                  Current credits: <strong>{credits.toLocaleString()}</strong>
                </span>
              )}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSync}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Billing Status
              </button>
              <Link
                to="/app/billing"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go to Billing
              </Link>
            </div>
            {lastUpdateTime && (
              <p className="mt-4 text-xs text-gray-500">
                Last checked: {lastUpdateTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Billing Status
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {error.response?.data?.message || 'Failed to fetch billing information. Please try again.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSync}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <Link
                to="/app/billing"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Go to Billing
              </Link>
            </div>
          </div>
        )}

        {sessionId && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{sessionId}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

