import { CheckCircle } from 'lucide-react';

export function PublicSuccess({
  message,
  title = 'Success',
}: {
  message: string
  title?: string
}) {
  return (
    <div className="text-center py-8 text-white space-y-2">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0ed7c4]/15 border border-[#0ed7c4]/30">
        <CheckCircle className="w-7 h-7 text-[#0ed7c4]" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-white/75">{message}</p>
    </div>
  );
}
