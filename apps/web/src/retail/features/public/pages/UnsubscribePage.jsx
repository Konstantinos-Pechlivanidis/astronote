import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import PublicCard from '../components/PublicCard';
import PublicLoading from '../components/PublicLoading';
import PublicError from '../components/PublicError';
import PublicSuccess from '../components/PublicSuccess';
import { usePreferences } from '../hooks/usePreferences';
import { useUnsubscribe } from '../hooks/useUnsubscribe';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const pageToken = searchParams.get('pt');
  const [confirmed, setConfirmed] = useState(false);

  const { data: preferences, isLoading, error } = usePreferences(pageToken);
  const unsubscribeMutation = useUnsubscribe();

  useEffect(() => {
    if (!pageToken) {
      // No pageToken - show error
    }
  }, [pageToken]);

  const handleUnsubscribe = () => {
    if (!pageToken) return;
    unsubscribeMutation.mutate(
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
            message="This unsubscribe link is invalid or expired. Please contact the store for help."
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (isLoading) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicLoading message="Loading..." />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (error) {
    const isInvalidToken = error.response?.status === 400 || error.response?.data?.code === 'INVALID_TOKEN';
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message={
              isInvalidToken
                ? 'This unsubscribe link is no longer valid. Please contact the store or try again from a more recent message.'
                : 'This link is invalid or expired. Please contact the store for help.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (confirmed || unsubscribeMutation.isSuccess) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Unsubscribed"
            message={
              unsubscribeMutation.data?.message ||
              `You have been unsubscribed from SMS messages${preferences?.store?.name ? ` from ${preferences.store.name}` : ''}.`
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  const storeName = preferences?.store?.name || 'this store';
  const contactName = preferences?.contact?.firstName
    ? `${preferences.contact.firstName}${preferences.contact.lastNameInitial ? ` ${preferences.contact.lastNameInitial}.` : ''}`
    : null;

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unsubscribe</h1>
          <p className="text-sm text-gray-600 mb-6">
            {contactName ? `Hi ${contactName}, ` : ''}Do you want to stop receiving SMS messages from{' '}
            <strong>{storeName}</strong>?
          </p>
          <div className="space-y-4">
            <button
              onClick={handleUnsubscribe}
              disabled={unsubscribeMutation.isPending}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {unsubscribeMutation.isPending ? 'Processing...' : 'Yes, Unsubscribe Me'}
            </button>
            <p className="text-xs text-gray-500">
              You can resubscribe at any time by contacting the store.
            </p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

