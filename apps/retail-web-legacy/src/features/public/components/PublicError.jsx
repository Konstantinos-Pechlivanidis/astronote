import { AlertCircle } from 'lucide-react';

export default function PublicError({ message, title = 'Something went wrong' }) {
  return (
    <div className="text-center py-8">
      <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {message || 'This link is invalid or expired. Please contact the store for help.'}
      </p>
      <p className="text-xs text-gray-500">
        If you believe this is an error, please contact the store directly.
      </p>
    </div>
  );
}

