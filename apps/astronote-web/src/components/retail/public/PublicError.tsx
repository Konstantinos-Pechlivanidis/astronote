import { AlertCircle } from 'lucide-react';

export function PublicError({
  message,
  title = 'Something went wrong',
}: {
  message?: string
  title?: string
}) {
  return (
    <div className="text-center py-8 space-y-2 text-text-primary">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 border border-red-400/30">
        <AlertCircle className="w-7 h-7 text-red-300" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-text-secondary">
        {message || 'This link is invalid or expired. Please contact the store for help.'}
      </p>
      <p className="text-xs text-text-tertiary">
        If you believe this is an error, please contact the store directly.
      </p>
    </div>
  );
}
