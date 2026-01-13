'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useFinalizeSubscription } from '@/src/features/shopify/billing/hooks/useSubscriptionMutations';
import { RetailErrorBanner } from '@/src/components/retail/RetailErrorBanner';

/**
 * Billing Success Page Content
 */
function BillingSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finalized, setFinalized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalizeMutation = useFinalizeSubscription();

  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type');

  // Validate session_id
  useEffect(() => {
    if (!sessionId || sessionId.includes('{') || sessionId.includes('CHECKOUT_SESSION_ID')) {
      setError('Invalid checkout session. Please complete the checkout process.');
      return;
    }

    // Only finalize subscription type
    if (type === 'subscription' && !finalized && !finalizeMutation.isPending) {
      finalizeMutation.mutate(
        { sessionId, type },
        {
          onSuccess: () => {
            setFinalized(true);
          },
          onError: (err: any) => {
            const errorMessage = err?.message || err?.response?.data?.message || 'Failed to finalize subscription';
            setError(errorMessage);
          },
        },
      );
    } else if (type !== 'subscription') {
      // For non-subscription types, just mark as finalized
      setFinalized(true);
    }
  }, [sessionId, type, finalized, finalizeMutation]);

  useEffect(() => {
    // Auto-redirect after 5 seconds (only if finalized or error)
    if (finalized || error) {
      const timer = setTimeout(() => {
        router.push('/app/shopify/billing');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [router, finalized, error]);

  // Show error state
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
              if (sessionId && type === 'subscription') {
                finalizeMutation.mutate({ sessionId, type });
              }
            }}
          />
          <div className="flex items-center justify-center gap-3">
            <Link href="/app/shopify/billing">
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

  // Show loading state (finalizing subscription)
  if (type === 'subscription' && !finalized && finalizeMutation.isPending) {
    return (
      <RetailPageLayout>
        <div className="space-y-6">
          <RetailPageHeader title="Processing Payment" />
          <RetailCard className="p-6">
            <div className="text-center py-8">
              <Loader2 className="mx-auto h-16 w-16 text-blue-500 mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-text-primary mb-2">Finalizing Subscription</h2>
              <p className="text-sm text-text-secondary mb-6">
                Please wait while we activate your subscription...
              </p>
            </div>
          </RetailCard>
        </div>
      </RetailPageLayout>
    );
  }

  // Show success state
  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader title="Payment Successful" />
        <RetailCard className="p-6">
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold text-text-primary mb-2">Payment Completed Successfully</h2>
            <p className="text-sm text-text-secondary mb-6">
              {type === 'subscription'
                ? 'Your subscription has been activated. You can now access all subscription features.'
                : type === 'credit_topup'
                  ? 'Your credits have been added to your account. You can start using them immediately.'
                  : type === 'credit_pack'
                    ? 'Your credit pack purchase has been completed. Credits have been added to your account.'
                    : 'Your payment has been processed successfully.'}
            </p>
            {finalizeMutation.data?.creditsAllocated && finalizeMutation.data.credits && (
              <p className="text-sm text-green-600 mb-4">
                {finalizeMutation.data.credits} free credits have been added to your account.
              </p>
            )}
            <div className="flex items-center justify-center gap-3">
              <Link href="/app/shopify/billing">
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

/**
 * Billing Success Page
 * Wrapped in Suspense for useSearchParams()
 */
export default function BillingSuccessPage() {
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
      <BillingSuccessPageContent />
    </Suspense>
  );
}
