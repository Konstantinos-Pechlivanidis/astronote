'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailErrorBanner } from '@/src/components/retail/RetailErrorBanner';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/src/lib/retail/api/axios';

function RetailBillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finalized, setFinalized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId || sessionId.includes('{') || sessionId.includes('CHECKOUT_SESSION_ID')) {
      setError('Invalid checkout session. Please complete the checkout process.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Retail backend: finalize is best-effort; falls back to reconcile if finalize is unavailable.
        await api.post('/subscriptions/finalize', { sessionId });
        if (!cancelled) setFinalized(true);
      } catch (e: any) {
        const status = e?.response?.status;
        const code = e?.response?.data?.code;

        // If finalize endpoint doesn't exist yet or is not enabled, fallback to reconcile.
        if (status === 404 || code === 'NOT_FOUND') {
          try {
            await api.post('/subscriptions/reconcile');
            if (!cancelled) setFinalized(true);
            return;
          } catch (reconcileErr: any) {
            const msg =
              reconcileErr?.response?.data?.message ||
              reconcileErr?.message ||
              'Failed to refresh subscription from Stripe';
            if (!cancelled) setError(msg);
            return;
          }
        }

        const msg = e?.response?.data?.message || e?.message || 'Failed to finalize subscription';
        if (!cancelled) setError(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (finalized || error) {
      const timer = setTimeout(() => {
        router.push('/app/retail/billing');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [router, finalized, error]);

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
              <h2 className="text-2xl font-bold text-text-primary mb-2">Finalizing</h2>
              <p className="text-sm text-text-secondary mb-6">
                Syncing your subscription and invoices from Stripe...
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
              Your subscription/payment has been processed. Redirecting you back to billing.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/app/retail/billing">
                <Button>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Billing
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-text-tertiary">
              Redirecting automatically in 5 seconds...
            </p>
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


