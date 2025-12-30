import { Package, ShoppingCart } from 'lucide-react';
import { usePurchasePackage } from '../hooks/usePurchasePackage';
import { useState } from 'react';

export default function PackageCard({ pkg }) {
  const purchaseMutation = usePurchasePackage();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const priceEur = (pkg.priceCents / 100).toFixed(2);

  const handlePurchase = () => {
    setIsPurchasing(true);
    purchaseMutation.mutate(
      { packageId: pkg.id, currency: 'EUR' },
      {
        onError: () => {
          setIsPurchasing(false);
        },
      },
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">{pkg.name}</h3>
      </div>
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {pkg.units.toLocaleString()} credits
        </div>
        <div className="text-lg text-gray-600">€{priceEur}</div>
      </div>
      <button
        onClick={handlePurchase}
        disabled={isPurchasing || purchaseMutation.isPending || !pkg.available}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPurchasing || purchaseMutation.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing...
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            Purchase
          </>
        )}
      </button>
      {!pkg.available && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Stripe checkout not available for this package
        </p>
      )}
    </div>
  );
}

