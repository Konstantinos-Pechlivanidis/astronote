'use client';

import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useOffer } from '@/src/features/retail/public/hooks/useOffer';
import { Gift } from 'lucide-react';

export default function OfferPage() {
  const params = useParams();
  const trackingId = params.trackingId as string;
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
    const isNotFound =
      (error as any)?.response?.status === 404 ||
      (error as any)?.response?.data?.code === 'RESOURCE_NOT_FOUND';
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
          <Gift className="w-12 h-12 text-accent mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary mb-2">Special Offer</h1>
          <p className="text-sm text-text-secondary mb-6">From {storeName}</p>
          <div className="bg-surface-light rounded-lg p-4 mb-6">
            <p className="text-lg text-text-primary whitespace-pre-wrap">{offerText}</p>
          </div>
          <div className="text-sm text-text-tertiary">
            <p>Please visit the store to redeem this offer.</p>
            <p className="mt-2">Show this page to the store staff.</p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

