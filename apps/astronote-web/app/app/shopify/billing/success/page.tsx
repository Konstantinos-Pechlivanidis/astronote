'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

/**
 * Billing Success Page Content
 */
function BillingSuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Auto-redirect after 5 seconds
    const timer = setTimeout(() => {
      router.push('/app/shopify/billing');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type');

  return (
    <div>
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
          {sessionId && (
            <p className="text-xs text-text-tertiary mb-6">
              Session ID: {sessionId}
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
        <div>
          <RetailPageHeader title="Payment Successful" />
          <RetailCard className="p-6">
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary">Loading...</p>
            </div>
          </RetailCard>
        </div>
      }
    >
      <BillingSuccessPageContent />
    </Suspense>
  );
}
