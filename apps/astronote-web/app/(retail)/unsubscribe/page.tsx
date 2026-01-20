'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { usePreferences } from '@/src/features/retail/public/hooks/usePreferences';
import { useUnsubscribe } from '@/src/features/retail/public/hooks/useUnsubscribe';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShieldCheck, ThumbsUp, BellOff } from 'lucide-react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const pathToken = typeof params?.token === 'string' ? params.token : null;
  const pageToken = pathToken || searchParams.get('pt') || searchParams.get('token') || null;
  const [confirmed, setConfirmed] = useState(false);

  const { data: preferences, isLoading, error } = usePreferences(pageToken);
  const unsubscribeMutation = useUnsubscribe();

  const handleUnsubscribe = () => {
    if (!pageToken) return;
    unsubscribeMutation.mutate(
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
        <div className="space-y-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#0ed7c4]/15 border border-[#0ed7c4]/30 flex items-center justify-center text-[#0ed7c4]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">Your preferences</p>
              <h1 className="text-2xl font-bold">Stay in the loop or unsubscribe</h1>
              <p className="text-sm text-white/70">
                {contactName ? `Hi ${contactName}, ` : ''}messages from <strong>{storeName}</strong> are tailored for you.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-[#0ed7c4] mb-2">
                <ThumbsUp className="w-4 h-4" />
                <p className="text-sm font-semibold text-white">Why stay subscribed</p>
              </div>
              <ul className="text-sm text-white/80 space-y-2">
                <li>• Early access to offers and drops.</li>
                <li>• Personalized rewards based on your visits.</li>
                <li>• Zero spam—only store updates that matter.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[#0ed7c4]/30 bg-[#0ed7c4]/5 p-4">
              <div className="flex items-center gap-2 text-[#0ed7c4] mb-2">
                <BellOff className="w-4 h-4" />
                <p className="text-sm font-semibold text-white">Unsubscribe anytime</p>
              </div>
              <p className="text-sm text-white/80 mb-3">
                If you prefer to opt out, we will stop SMS immediately—no questions asked.
              </p>
              <Button
                onClick={handleUnsubscribe}
                disabled={unsubscribeMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 border border-red-500/60"
              >
                {unsubscribeMutation.isPending ? 'Processing...' : 'Unsubscribe now'}
              </Button>
              <p className="text-xs text-white/60 mt-2">You can resubscribe later by contacting the store.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80">
              Prefer to stay? Explore what we do and how we protect your data.
            </div>
            <div className="flex gap-2">
              <Link
                href="https://astronote.onrender.com"
                className="px-4 py-2 text-sm rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
              >
                Learn more
              </Link>
              <Link
                href="/"
                className="px-4 py-2 text-sm rounded-lg bg-[#0ed7c4] text-[#0b1f2e] hover:bg-[#12b6a7] transition font-semibold"
              >
                Keep me subscribed
              </Link>
            </div>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

export default function UnsubscribePage() {
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
