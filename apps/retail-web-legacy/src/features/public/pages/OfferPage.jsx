import { useParams } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import PublicCard from '../components/PublicCard';
import PublicLoading from '../components/PublicLoading';
import PublicError from '../components/PublicError';
import PublicSuccess from '../components/PublicSuccess';
import { useOffer } from '../hooks/useOffer';
import { Gift, CheckCircle } from 'lucide-react';

export default function OfferPage() {
  const { trackingId } = useParams();
  const { data, isLoading, error } = useOffer(trackingId);

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading offer..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error) {
    const isNotFound = error.response?.status === 404 || error.response?.data?.code === 'RESOURCE_NOT_FOUND';
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title={isNotFound ? 'Offer Not Found' : 'Error'}
            message={
              isNotFound
                ? 'This offer link is invalid or has expired. Please contact the store for assistance.'
                : 'This link is invalid or expired. Please contact the store for help.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (!data) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError message="Offer not found. Please contact the store for help." />
        </PublicCard>
      </PublicLayout>
    );
  }

  const { storeName, offerText, isRedeemed } = data;

  if (isRedeemed) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Offer Already Redeemed"
            message={`This offer from ${storeName} has already been redeemed.`}
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <Gift className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Special Offer</h1>
          <p className="text-sm text-gray-600 mb-6">From {storeName}</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-lg text-gray-900 whitespace-pre-wrap">{offerText}</p>
          </div>
          <div className="text-sm text-gray-500">
            <p>Please visit the store to redeem this offer.</p>
            <p className="mt-2">Show this page to the store staff.</p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

