import { useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import ErrorState from '../../../components/common/ErrorState';
import LoadingState from '../../../components/common/LoadingState';
import BillingHeader from '../components/BillingHeader';
import SubscriptionCard from '../components/SubscriptionCard';
import PackageCard from '../components/PackageCard';
import CreditTopupCard from '../components/CreditTopupCard';
import TransactionsTable from '../components/TransactionsTable';
import { useBillingGate } from '../hooks/useBillingGate';
import { usePackages } from '../hooks/usePackages';
import { useTransactions } from '../hooks/useTransactions';
import { CreditCard, Package } from 'lucide-react';

export default function BillingPage() {
  const [transactionsPage, setTransactionsPage] = useState(1);
  const billingGate = useBillingGate();
  const { data: packages, isLoading: packagesLoading, error: packagesError } = usePackages();
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useTransactions({ page: transactionsPage, pageSize: 20 });

  if (billingGate.isLoading) {
    return (
      <div>
        <PageHeader title="Billing" subtitle="Loading..." />
        <LoadingState message="Loading billing information..." />
      </div>
    );
  }

  if (billingGate.error) {
    return (
      <div>
        <PageHeader title="Billing" subtitle="Error loading billing" />
        <ErrorState error={billingGate.error} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your subscription and purchase credits"
      />

      <BillingHeader
        subscription={billingGate.subscription}
        credits={billingGate.credits}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SubscriptionCard subscription={billingGate.subscription} />

        <CreditTopupCard />
      </div>

      {billingGate.subscription.active && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Credit Packages</h2>
          </div>
          {packagesLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-6">
                  <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          )}
          {packagesError && (
            <div className="bg-white rounded-lg shadow p-6">
              <ErrorState error={packagesError} />
            </div>
          )}
          {!packagesLoading && !packagesError && packages && (
            <>
              {packages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages
                    .filter((pkg) => pkg.type === 'subscription_package') // Only show subscription packages here
                    .map((pkg) => (
                      <PackageCard key={pkg.id} pkg={pkg} />
                    ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-600">No packages available at this time.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mb-6">
        <TransactionsTable
          transactions={transactionsData?.items || []}
          isLoading={transactionsLoading}
        />
        {transactionsData && transactionsData.total > 20 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(transactionsPage - 1) * 20 + 1} to{' '}
              {Math.min(transactionsPage * 20, transactionsData.total)} of{' '}
              {transactionsData.total} transactions
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                disabled={transactionsPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setTransactionsPage((p) => p + 1)}
                disabled={transactionsPage * 20 >= transactionsData.total}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
