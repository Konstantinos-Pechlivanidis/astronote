import { CheckCircle } from 'lucide-react';

export default function PublicSuccess({ message, title = 'Success' }) {
  return (
    <div className="text-center py-8">
      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

