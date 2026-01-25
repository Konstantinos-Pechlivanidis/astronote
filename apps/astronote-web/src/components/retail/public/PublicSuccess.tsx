import { CheckCircle } from 'lucide-react';

export function PublicSuccess({
  message,
  title = 'Success',
}: {
  message: string
  title?: string
}) {
  return (
    <div className="text-center py-8 space-y-2 text-text-primary">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-light border border-accent/30">
        <CheckCircle className="w-7 h-7 text-accent" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}
