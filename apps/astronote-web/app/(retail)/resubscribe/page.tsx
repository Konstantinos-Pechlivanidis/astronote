'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useResubscribe } from '@/src/features/retail/public/hooks/useResubscribe';
import { Button } from '@/components/ui/button';
import { Bell, ShieldCheck } from 'lucide-react';

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
      <PublicCard className="text-text-primary space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-accent-light border border-accent flex items-center justify-center text-accent">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-text-tertiary">Welcome back</p>
            <h1 className="text-2xl font-bold">Resubscribe to SMS updates</h1>
            <p className="text-sm text-text-secondary">
              Get offers and updates again. You can opt out anytime.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center gap-2 text-accent">
            <ShieldCheck className="w-4 h-4" />
            <p className="text-sm font-semibold text-text-primary">Trusted by Astronote</p>
          </div>
          <p className="text-sm text-text-secondary">
            We only send relevant messages. Reply STOP or use the unsubscribe link to opt out instantly.
          </p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={handleResubscribe}
            disabled={resubscribeMutation.isPending}
            className="w-full bg-accent text-[#041b1f] hover:bg-accent-hover"
          >
            {resubscribeMutation.isPending ? 'Processing...' : 'Yes, resubscribe me'}
          </Button>
          <p className="text-xs text-text-tertiary text-center">
            You can unsubscribe at any time.
          </p>
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
