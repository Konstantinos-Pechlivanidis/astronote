export const dynamic = 'force-dynamic';

import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { Button } from '@/components/ui/button';

export default function LinkNotAvailablePage() {
  return (
    <PublicLayout>
      <PublicCard className="text-center space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-text-primary">This link is no longer available.</h1>
          <p className="text-sm text-text-secondary">
            The link may have expired or been replaced. Please contact the store for a fresh link or return to the home page.
          </p>
        </div>
        <Button type="button" onClick={() => { window.location.href = 'https://astronote.onrender.com'; }}>
          Go to homepage
        </Button>
      </PublicCard>
    </PublicLayout>
  );
}
