import { AlertCircle } from 'lucide-react';
import { getErrorMessage } from '../../api/errors';

export default function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message = getErrorMessage(error);
  
  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

