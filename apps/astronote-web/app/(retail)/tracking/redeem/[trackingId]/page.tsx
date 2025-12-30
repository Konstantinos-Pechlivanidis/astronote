'use client';

import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { useRedeemStatus } from '@/src/features/retail/public/hooks/useRedeemStatus';
import { CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function RedeemPage() {
  const params = useParams();
  const trackingId = params.trackingId as string;
  const { data, isLoading, error } = useRedeemStatus(trackingId);

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading redemption status..." />
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
            title={isNotFound ? 'Invalid Link' : 'Error'}
            message={
              isNotFound
                ? 'This redemption link is invalid or has expired. Please contact the store for assistance.'
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
          <PublicError message="Redemption status not found. Please contact the store for help." />
        </PublicCard>
      </PublicLayout>
    );
  }

  const { isRedeemed, redeemedAt, storeName } = data;

  if (isRedeemed) {
    return (
      <PublicLayout>
        <PublicCard>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">Already Redeemed</h2>
            <p className="text-sm text-text-secondary mb-2">
              This offer{storeName ? ` from ${storeName}` : ''} has already been redeemed.
            </p>
            {redeemedAt && (
              <p className="text-xs text-text-tertiary">
                Redeemed on {format(new Date(redeemedAt), 'PPpp')}
              </p>
            )}
          </div>
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center py-8">
          <XCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Not Yet Redeemed</h2>
          <p className="text-sm text-text-secondary">
            This offer{storeName ? ` from ${storeName}` : ''} has not been redeemed yet.
          </p>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

