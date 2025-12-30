import { AlertCircle } from 'lucide-react';

export function PublicError({
  message,
  title = 'Something went wrong',
}: {
  message?: string
  title?: string
}) {
  return (
    <div className="text-center py-8">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary mb-4">
        {message || 'This link is invalid or expired. Please contact the store for help.'}
      </p>
      <p className="text-xs text-text-tertiary">
        If you believe this is an error, please contact the store directly.
      </p>
    </div>
  );
}

