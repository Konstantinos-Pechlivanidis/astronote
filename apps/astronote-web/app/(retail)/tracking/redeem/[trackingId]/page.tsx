'use client';

import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { useRedeemStatus } from '@/src/features/retail/public/hooks/useRedeemStatus';
import { CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function RedeemPage() {
  const params = useParams();
  const trackingId = params.trackingId as string;
  const { data, isLoading, error } = useRedeemStatus(trackingId);

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Verifying redemption..." />
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
        <PublicCard className="text-text-primary space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent-light border border-accent flex items-center justify-center text-accent">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-text-tertiary">Success</p>
              <h2 className="text-xl font-semibold text-text-primary">Offer redeemed</h2>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            This offer{storeName ? ` from ${storeName}` : ''} has been redeemed.
          </p>
          {redeemedAt && (
            <p className="text-xs text-text-tertiary">
              Redeemed on {format(new Date(redeemedAt), 'PPpp')}
            </p>
          )}
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard className="text-text-primary space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-primary">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-text-tertiary">Not yet redeemed</p>
            <h2 className="text-xl font-semibold text-text-primary">Awaiting redemption</h2>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          This offer{storeName ? ` from ${storeName}` : ''} has not been redeemed yet. Show your offer page or QR at checkout to redeem.
        </p>
      </PublicCard>
    </PublicLayout>
  );
}
