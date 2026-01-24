'use client';

import Link from 'next/link';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function RetailBillingCancelPage() {
  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader title="Payment Cancelled" />
        <RetailCard className="p-6">
          <div className="text-center py-8">
            <XCircle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold text-text-primary mb-2">Payment Cancelled</h2>
            <p className="text-sm text-text-secondary mb-6">
              Your payment was cancelled. No charges were made to your account. You can return to Billing to try again.
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

