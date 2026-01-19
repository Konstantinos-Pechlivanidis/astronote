'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { usePreferences } from '@/src/features/retail/public/hooks/usePreferences';
import { useUnsubscribe } from '@/src/features/retail/public/hooks/useUnsubscribe';
import { Button } from '@/components/ui/button';

function UnsubscribeContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathToken = typeof params?.token === 'string' ? params.token : null;
  const pageToken = pathToken || searchParams.get('pt') || searchParams.get('token') || null;
  const [confirmed, setConfirmed] = useState(false);

  // ensure we hydrate preferences only when token present
  const { data: preferences, isLoading, error } = usePreferences(pageToken);
  const unsubscribeMutation = useUnsubscribe();

  useEffect(() => {
    if (!pageToken) {
      setConfirmed(false);
    }
  }, [pageToken]);

  const handleUnsubscribe = () => {
    if (!pageToken) return;
    unsubscribeMutation.mutate(
      { pageToken },
      {
        onSuccess: () => setConfirmed(true),
      },
    );
  };

  if (!pageToken) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message="This unsubscribe link is invalid or expired. Please contact the store for help."
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error) {
    const isInvalidToken =
      (error as any)?.response?.status === 400 ||
      (error as any)?.response?.data?.code === 'INVALID_TOKEN';
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message={
              isInvalidToken
                ? 'This unsubscribe link is no longer valid. Please contact the store or try again from a more recent message.'
                : 'This link is invalid or expired. Please contact the store for help.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (confirmed || unsubscribeMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Unsubscribed"
            message={
              unsubscribeMutation.data?.message ||
              `You have been unsubscribed from SMS messages${
                preferences?.store?.name ? ` from ${preferences.store.name}` : ''
              }.`
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  const storeName = preferences?.store?.name || 'this store';
  const contactName = preferences?.contact?.firstName
    ? `${preferences.contact.firstName}${
      preferences.contact.lastNameInitial
        ? ` ${preferences.contact.lastNameInitial}.`
        : ''
    }`
    : null;

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Stay in the loop or unsubscribe</h1>
          <p className="text-sm text-text-secondary mb-6">
            {contactName ? `Hi ${contactName}, ` : ''}we send offers and updates from <strong>{storeName}</strong>. You can opt out below and we’ll respect your choice.
          </p>
          <div className="space-y-4">
            <Button
              onClick={handleUnsubscribe}
              disabled={unsubscribeMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {unsubscribeMutation.isPending ? 'Processing...' : 'Yes, Unsubscribe Me'}
            </Button>
            <div className="text-xs text-text-tertiary space-y-2">
              <p>You can unsubscribe anytime; we’ll stop messages right away.</p>
              <p>If you change your mind, contact the store to resubscribe.</p>
            </div>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

export default function UnsubscribeTokenPage() {
  return (
    <Suspense fallback={
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
