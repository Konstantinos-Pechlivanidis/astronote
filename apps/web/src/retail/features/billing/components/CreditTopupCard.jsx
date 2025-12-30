import { CreditCard, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTopupCredits } from '../hooks/useTopupCredits';
import { usePackages } from '../hooks/usePackages';
import LoadingState from '../../../components/common/LoadingState';
import ErrorState from '../../../components/common/ErrorState';

export default function CreditTopupCard() {
  const [selectedPackId, setSelectedPackId] = useState(null);
  const { data: packages, isLoading: packagesLoading, error: packagesError } = usePackages();
  const topupMutation = useTopupCredits();

  // Filter credit packs (type: 'credit_pack')
  const creditPacks = packages?.filter(pkg => pkg.type === 'credit_pack') || [];

  // Set default selection to first pack
  useEffect(() => {
    if (creditPacks.length > 0 && !selectedPackId) {
      setSelectedPackId(creditPacks[0].id);
    }
  }, [creditPacks, selectedPackId]);

  const selectedPack = creditPacks.find(pkg => pkg.id === selectedPackId);

  const handleTopup = () => {
    if (!selectedPackId) return;
    // Ensure packId is string (billingApi.topup also normalizes, but defensive here)
    const packIdString = String(selectedPackId);
    if (!packIdString || !packIdString.startsWith('pack_')) {
      console.error('[Billing] Invalid packId format:', selectedPackId);
      return;
    }
    topupMutation.mutate({ packId: packIdString });
  };

  if (packagesLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingState message="Loading credit packs..." />
      </div>
    );
  }

  if (packagesError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <ErrorState error={packagesError} />
      </div>
    );
  }

  if (creditPacks.length === 0) {
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
        Purchase credit packs. 1 credit = 1 SMS message. Credits can be purchased regardless of subscription status, but can only be <strong>used</strong> with an active subscription.
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="creditPack" className="block text-sm font-medium text-gray-700 mb-1">
            Select Credit Pack
          </label>
          <select
            id="creditPack"
            value={selectedPackId || ''}
            onChange={(e) => setSelectedPackId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {creditPacks.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.units.toLocaleString()} credits - €{((pack.priceCents || pack.priceEur * 100) / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        {selectedPack && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Credits:</span>
              <span className="font-medium text-gray-900">{selectedPack.units.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total:</span>
              <span>€{((selectedPack.priceCents || selectedPack.priceEur * 100) / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleTopup}
          disabled={!selectedPackId || topupMutation.isPending || !selectedPack?.available}
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
              Buy {selectedPack ? `${selectedPack.units.toLocaleString()} Credits` : 'Credits'}
            </>
          )}
        </button>
        {selectedPack && !selectedPack.available && (
          <p className="text-xs text-gray-500 text-center">
            This pack is not available for purchase at this time.
          </p>
        )}
      </div>
    </div>
  );
}

