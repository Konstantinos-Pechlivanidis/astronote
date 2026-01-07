'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { PublicLoading } from '@/src/components/retail/public/PublicLoading';
import { PublicError } from '@/src/components/retail/public/PublicError';
import { PublicSuccess } from '@/src/components/retail/public/PublicSuccess';
import axios from 'axios';

type RedeemStatus = 'idle' | 'loading' | 'redeemed' | 'already_redeemed' | 'not_found' | 'error';

export default function PublicRedeemPage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [status, setStatus] = useState<RedeemStatus>('idle');
  const [redeemedAt, setRedeemedAt] = useState<string | null>(null);

  useEffect(() => {
    const redeem = async () => {
      if (!trackingId) return;
      setStatus('loading');
      try {
        const res = await axios.post(`/api/tracking/redeem-public/${trackingId}`);
        const s = res.data?.status;
        if (s === 'redeemed') {
          setRedeemedAt(res.data?.redeemedAt || null);
          setStatus('redeemed');
        } else if (s === 'already_redeemed') {
          setRedeemedAt(res.data?.redeemedAt || null);
          setStatus('already_redeemed');
        } else {
          setStatus('error');
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setStatus('not_found');
        } else {
          setStatus('error');
        }
      }
    };
    redeem();
  }, [trackingId]);

  if (status === 'loading' || status === 'idle') {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Redeeming..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (status === 'redeemed') {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Redeemed"
            message={redeemedAt ? `Redeemed at ${new Date(redeemedAt).toLocaleString()}` : 'Offer redeemed successfully.'}
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (status === 'already_redeemed') {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Already Redeemed"
            message={redeemedAt ? `Redeemed at ${new Date(redeemedAt).toLocaleString()}` : 'This offer was already redeemed.'}
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (status === 'not_found') {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError title="Not Found" message="This offer link is invalid or expired." />
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <PublicError title="Error" message="Could not redeem this offer. Please contact the store." />
      </PublicCard>
    </PublicLayout>
  );
}
