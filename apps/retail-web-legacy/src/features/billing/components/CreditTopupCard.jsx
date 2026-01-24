import { CreditCard, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../../api/modules/billing';
import { queryKeys } from '../../../lib/queryKeys';
import { useTopupCredits } from '../hooks/useTopupCredits';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';

export default function CreditTopupCard() {
  const [selectedCredits, setSelectedCredits] = useState(null);
  const { data: tiersData, isLoading: tiersLoading, error: tiersError } = useQuery({
    queryKey: queryKeys.billing.topupTiers,
    queryFn: async () => {
      const res = await billingApi.getTopupTiers();
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
  const topupMutation = useTopupCredits();

  const tiers = Array.isArray(tiersData?.tiers) ? tiersData.tiers : [];

  // Set default selection to first tier
  useEffect(() => {
    if (tiers.length > 0 && !selectedCredits) {
      setSelectedCredits(tiers[0].credits);
    }
  }, [tiers, selectedCredits]);

  const selectedTier = tiers.find(tier => tier.credits === selectedCredits);

  const handleTopup = () => {
    if (!selectedTier) return;
    topupMutation.mutate({ credits: selectedTier.credits });
  };

  if (tiersLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingState message="Loading top-up options..." />
      </div>
    );
  }

  if (tiersError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <ErrorState error={tiersError} />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Buy Credits</h3>
        </div>
        <p className="text-sm text-gray-600">
          Credit packs are not available at this time. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Buy Credits</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Credits accumulate and never expire; spending requires an active subscription.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="creditPack" className="block text-sm font-medium text-gray-700 mb-1">
            Select Credits
          </label>
          <select
            id="creditPack"
            value={selectedCredits || ''}
            onChange={(e) => setSelectedCredits(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {tiers.map((tier) => (
              <option key={tier.credits} value={tier.credits}>
                {tier.credits.toLocaleString()} credits - €{tier.amount.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        {selectedTier && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Credits:</span>
              <span className="font-medium text-gray-900">{selectedTier.credits.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total:</span>
              <span>€{selectedTier.amount.toFixed(2)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleTopup}
          disabled={!selectedTier || topupMutation.isPending}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {topupMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Buy {selectedTier ? `${selectedTier.credits.toLocaleString()} Credits` : 'Credits'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
