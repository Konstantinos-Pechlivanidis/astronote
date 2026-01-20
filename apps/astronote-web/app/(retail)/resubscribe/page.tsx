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
      <PublicCard className="text-white space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#0ed7c4]/15 border border-[#0ed7c4]/30 flex items-center justify-center text-[#0ed7c4]">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/60">Welcome back</p>
            <h1 className="text-2xl font-bold">Resubscribe to SMS updates</h1>
            <p className="text-sm text-white/70">
              Get offers and updates again. You can opt out anytime.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-[#0ed7c4]">
            <ShieldCheck className="w-4 h-4" />
            <p className="text-sm font-semibold text-white">Trusted by Astronote</p>
          </div>
          <p className="text-sm text-white/80">
            We only send relevant messages. Reply STOP or use the unsubscribe link to opt out instantly.
          </p>
        </div>
        <div className="space-y-3">
          <Button
            onClick={handleResubscribe}
            disabled={resubscribeMutation.isPending}
            className="w-full bg-[#0ed7c4] text-[#0b1f2e] hover:bg-[#12b6a7]"
          >
            {resubscribeMutation.isPending ? 'Processing...' : 'Yes, resubscribe me'}
          </Button>
          <p className="text-xs text-white/60 text-center">
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
