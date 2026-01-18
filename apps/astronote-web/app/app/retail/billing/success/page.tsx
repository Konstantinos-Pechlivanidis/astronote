'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailErrorBanner } from '@/src/components/retail/RetailErrorBanner';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/src/lib/retail/api/axios';
import { endpoints } from '@/src/lib/retail/api/endpoints';
import { useQueryClient } from '@tanstack/react-query';

function RetailBillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finalized, setFinalized] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const redirectedRef = useRef(false);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const placeholder =
      sessionId === '{CHECKOUT_SESSION_ID}' ||
      sessionId === '%7BCHECKOUT_SESSION_ID%7D' ||
      sessionId?.includes('CHECKOUT_SESSION_ID') ||
      sessionId?.includes('%7B') ||
      sessionId?.includes('%7D');

    if (!sessionId) {
      setError('Λείπει το checkout session. Επιστρέψτε στη χρέωση και ξαναπροσπαθήστε.');
      return;
    }

    if (placeholder) {
      setError(
        'Η πληρωμή ολοκληρώθηκε στο Stripe αλλά δεν επιστράφηκε σωστό session_id. Πάτησε "Back to Billing" και κάνε Refresh/Verify ή ξαναδοκίμασε.',
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setVerifying(true);
        // Parity: always verify the payment first (handles subscription + topup + credit packs).
        const verifyRes = await api.post(endpoints.billing.verifyPayment, { sessionId });
        const paymentType = verifyRes?.data?.paymentType || 'unknown';

        // If subscription, we may additionally call finalize (idempotent) and reconcile.
        if (paymentType === 'subscription') {
          try {
            await api.post(endpoints.subscriptions.finalize, { sessionId });
          } catch {
            // ignore: verify-payment already did best-effort activation
          }
          try {
            await api.post(endpoints.subscriptions.reconcile);
          } catch {
            // ignore: billing page will still be stripe-synced on load
          }
        }

        if (!cancelled) setFinalized(true);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Failed to finalize subscription';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (finalized && !redirectedRef.current) {
      redirectedRef.current = true;
      (async () => {
        const keysToInvalidate = [
          ['retail-billing-summary'],
          ['retail-transactions'],
          ['retail-invoices'],
          ['retail-billing-history'],
          ['retail-subscription-current'],
          ['retail-packages'],
        ];
        await Promise.all(
          keysToInvalidate.map((key) =>
            queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined),
          ),
        );
        router.replace('/app/retail/billing?paymentSuccess=1');
        router.refresh();
      })();
    }
  }, [finalized, queryClient, router]);

  if (error) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Payment Processing Error" />
          <RetailErrorBanner
            title="Failed to process payment"
            description={error}
            onRetry={() => {
              setError(null);
              router.refresh();
            }}
          />
          <div className="flex items-center justify-center gap-3">
            <Link href="/app/retail/billing">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Billing
              </Button>
            </Link>
          </div>
        </div>
      </RetailPageLayout>
    );
  }

  if (!finalized) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Processing Payment" />
          <RetailCard className="p-6">
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-16 w-16 text-blue-500 mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                {verifying ? 'Verifying payment' : 'Finalizing'}
              </h2>
              <p className="text-sm text-text-secondary mb-6">
                Συγχρονίζουμε τη συνδρομή/credits και τα τιμολόγια από το Stripe. Μόλις ολοκληρωθεί θα
                σε επιστρέψουμε αυτόματα στη σελίδα χρέωσης.
              </p>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader title="Payment Successful" />
        <RetailCard className="p-6">
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-text-primary mb-2">Payment Completed Successfully</h2>
            <p className="text-sm text-text-secondary mb-6">
              Your subscription/payment has been processed. Returning you to billing to refresh balances and invoices.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/app/retail/billing">
                <Button>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Billing
                </Button>
              </Link>
            </div>
          </div>
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}

export default function RetailBillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <RetailPageLayout>
          <div className="space-y-6">
            <RetailPageHeader title="Payment Successful" />
            <RetailCard className="p-6">
              <div className="text-center py-8">
                <p className="text-sm text-text-secondary">Loading...</p>
              </div>
            </RetailCard>
          </div>
        </RetailPageLayout>
      }
    >
      <RetailBillingSuccessContent />
    </Suspense>
  );
}
