'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to error tracking service in production
    console.error('Retail app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <RetailCard className="max-w-md w-full">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary mb-6">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
            <Button onClick={() => (window.location.href = '/app/retail/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </RetailCard>
    </div>
  );
}

