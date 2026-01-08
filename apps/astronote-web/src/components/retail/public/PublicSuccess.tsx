import { CheckCircle } from 'lucide-react';

export function PublicSuccess({
  message,
  title = 'Success',
}: {
  message: string
  title?: string
}) {
  return (
    <div className="text-center py-8">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-[#EAF0FF] mb-2">{title}</h2>
      <p className="text-sm text-[#A9B4CC]">{message}</p>
    </div>
  );
}

