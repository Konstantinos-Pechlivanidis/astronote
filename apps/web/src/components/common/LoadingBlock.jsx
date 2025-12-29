import { Loader2 } from 'lucide-react';

export default function LoadingBlock({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

