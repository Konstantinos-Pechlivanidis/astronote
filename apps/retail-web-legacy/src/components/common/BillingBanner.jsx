import { XCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBillingGate } from '../../features/billing/hooks/useBillingGate';
import { useState } from 'react';

export default function BillingBanner() {
  const billingGate = useBillingGate();
  const [dismissed, setDismissed] = useState(false);

  // Only show if subscription is inactive and not dismissed
  if (billingGate.isLoading || billingGate.canSendCampaigns || dismissed) {
    return null;
  }

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {billingGate.reason ||
                'Active subscription required to send campaigns. Subscribe now to start sending.'}
            </p>
          </div>
          <Link
            to={billingGate.ctaTarget || '/app/billing'}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Go to Billing
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-red-600 hover:text-red-800 ml-2"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

