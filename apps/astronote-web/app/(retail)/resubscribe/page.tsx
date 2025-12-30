'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useResubscribe } from '@/src/features/retail/public/hooks/useResubscribe';
import { Button } from '@/components/ui/button';

function ResubscribeContent() {
  const searchParams = useSearchParams();
  const pageToken = searchParams.get('pt');
  const [confirmed, setConfirmed] = useState(false);

  const resubscribeMutation = useResubscribe();

  const handleResubscribe = () => {
    if (!pageToken) return;
    resubscribeMutation.mutate(
      { pageToken },
      {
        onSuccess: () => {
          setConfirmed(true);
        },
      },
    );
  };

  if (!pageToken) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message="This resubscribe link is invalid or expired. Please contact the store for help."
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (confirmed || resubscribeMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Resubscribed"
            message={
              resubscribeMutation.data?.message ||
              'You have been resubscribed to SMS messages. You will start receiving messages again.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Resubscribe</h1>
          <p className="text-sm text-text-secondary mb-6">
            Would you like to start receiving SMS messages again?
          </p>
          <div className="space-y-4">
            <Button
              onClick={handleResubscribe}
              disabled={resubscribeMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {resubscribeMutation.isPending ? 'Processing...' : 'Yes, Resubscribe Me'}
            </Button>
            <p className="text-xs text-text-tertiary">
              You can unsubscribe at any time by replying STOP or using the unsubscribe link in
              messages.
            </p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

export default function ResubscribePage() {
  return (
    <Suspense fallback={
      <PublicLayout>
        <PublicCard>
          <div className="text-center py-8">Loading...</div>
        </PublicCard>
      </PublicLayout>
    }>
      <ResubscribeContent />
    </Suspense>
  );
}

