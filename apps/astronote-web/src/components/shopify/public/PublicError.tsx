import { AlertCircle } from 'lucide-react';

/**
 * Shopify Public Error Component
 * Isolated from Retail public components
 */
export function PublicError({
  title = 'Error',
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <div className="text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

