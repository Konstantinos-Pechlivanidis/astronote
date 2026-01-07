'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [redeemUrl, setRedeemUrl] = useState<string>('');
  const { data, isLoading, error } = useOffer(trackingId);

  useEffect(() => {
    if (typeof window !== 'undefined' && trackingId) {
      setRedeemUrl(`${window.location.origin}/retail/tracking/redeem/${trackingId}`);
    }
  }, [trackingId]);

  const qrImageUrl = useMemo(() => {
    if (!redeemUrl) return null;
    const encoded = encodeURIComponent(redeemUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
  }, [redeemUrl]);

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
          <div className="text-sm text-text-tertiary space-y-3">
            <p>Please visit the store to redeem this offer.</p>
            <p>Show this page (or the QR code below) to the store staff.</p>
            {qrImageUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrImageUrl}
                  alt="Redeem QR code"
                  className="w-48 h-48 border border-border rounded-lg bg-white"
                />
                <p className="text-xs text-text-secondary break-all">{redeemUrl}</p>
              </div>
            ) : null}
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
