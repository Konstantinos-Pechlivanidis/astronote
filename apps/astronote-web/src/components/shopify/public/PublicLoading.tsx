import { Loader2 } from 'lucide-react';

/**
 * Shopify Public Loading Component
 * Isolated from Retail public components
 */
export function PublicLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

