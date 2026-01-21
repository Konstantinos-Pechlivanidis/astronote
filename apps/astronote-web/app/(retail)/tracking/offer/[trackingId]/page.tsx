'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import { useOffer } from '@/src/features/retail/public/hooks/useOffer';
import { Gift, Sparkles, ShieldCheck } from 'lucide-react';

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
          <PublicLoading message="Loading your offer..." />
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
            title={isNotFound ? 'Offer Not Found' : 'We hit a snag'}
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
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#0ed7c4]/15 border border-[#0ed7c4]/40 flex items-center justify-center text-[#0ed7c4]">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">Exclusive Offer</p>
              <h1 className="text-2xl font-bold text-white">Claim your reward</h1>
              <p className="text-sm text-white/70">From {storeName}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-lg text-white whitespace-pre-wrap leading-relaxed">{offerText}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="rounded-2xl border border-[#0ed7c4]/30 bg-[#0ed7c4]/5 p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#0ed7c4]" />
                <p className="text-sm font-semibold">How to redeem</p>
              </div>
              <ul className="text-sm text-white/80 space-y-2">
                <li>1) Show this page at checkout.</li>
                <li>2) Staff scans the QR code or uses the link below.</li>
                <li>3) Enjoy your reward instantly.</li>
              </ul>
              {redeemUrl ? (
                <p className="mt-3 text-xs text-white/60 break-all">
                  Redeem URL: {redeemUrl}
                </p>
              ) : null}
            </div>
            {qrImageUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-lg">
                  <img
                    src={qrImageUrl}
                    alt="Redeem QR code"
                    className="w-48 h-48 md:w-56 md:h-56 rounded-xl bg-white"
                  />
                </div>
                <p className="text-xs text-white/70">Scan to redeem securely</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0ed7c4]" />
            <p className="text-sm text-white/80">
              Safe links on <strong>astronote.onrender.com</strong>. Each code is unique to your visit.
            </p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}
