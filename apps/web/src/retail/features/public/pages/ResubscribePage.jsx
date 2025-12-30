import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import PublicCard from '../components/PublicCard';
import PublicLoading from '../components/PublicLoading';
import PublicError from '../components/PublicError';
import PublicSuccess from '../components/PublicSuccess';
import { useResubscribe } from '../hooks/useResubscribe';

export default function ResubscribePage() {
  const [searchParams] = useSearchParams();
  const pageToken = searchParams.get('pt');
  const [confirmed, setConfirmed] = useState(false);

  const resubscribeMutation = useResubscribe();

  const handleResubscribe = () => {
    if (!pageToken) return;
    resubscribeMutation.mutate(
      { pageToken },
      {
        onSuccess: () => {
          setConfirmed(true);
        },
      }
    );
  };

  if (!pageToken) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message="This resubscribe link is invalid or expired. Please contact the store for help."
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (confirmed || resubscribeMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Resubscribed"
            message={
              resubscribeMutation.data?.message ||
              'You have been resubscribed to SMS messages. You will start receiving messages again.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Resubscribe</h1>
          <p className="text-sm text-gray-600 mb-6">
            Would you like to start receiving SMS messages again?
          </p>
          <div className="space-y-4">
            <button
              onClick={handleResubscribe}
              disabled={resubscribeMutation.isPending}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resubscribeMutation.isPending ? 'Processing...' : 'Yes, Resubscribe Me'}
            </button>
            <p className="text-xs text-gray-500">
              You can unsubscribe at any time by replying STOP or using the unsubscribe link in messages.
            </p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

