import { CheckCircle2 } from 'lucide-react';

/**
 * Shopify Public Success Component
 * Isolated from Retail public components
 */
export function PublicSuccess({
  title = 'Success',
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <div className="text-center">
      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

