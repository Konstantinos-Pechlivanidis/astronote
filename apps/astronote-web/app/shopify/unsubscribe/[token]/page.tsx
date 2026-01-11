'use client';

import { useParams } from 'next/navigation';
import { useState, Suspense, useEffect } from 'react';
import { PublicLayout } from '@/src/components/shopify/public/PublicLayout';
import { PublicCard } from '@/src/components/shopify/public/PublicCard';
import { PublicLoading } from '@/src/components/shopify/public/PublicLoading';
import { PublicError } from '@/src/components/shopify/public/PublicError';
import { PublicSuccess } from '@/src/components/shopify/public/PublicSuccess';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { SHOPIFY_API_BASE_URL } from '@/src/lib/shopify/config';

/**
 * Shopify Unsubscribe Page
 * Public page (no authentication required)
 * Handles unsubscribe flow for Shopify SMS campaigns
 */

interface UnsubscribeInfo {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phoneE164: string;
    smsConsent: string;
  };
  shop: {
    id: string;
    shopName: string;
    shopDomain: string;
  };
  token: string;
}

function UnsubscribeContent() {
  const params = useParams();
  const token = params.token as string | undefined;
  const [info, setInfo] = useState<UnsubscribeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch unsubscribe info on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid unsubscribe link');
      setIsLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        const response = await axios.get<{ success: boolean; data: UnsubscribeInfo }>(
          `${SHOPIFY_API_BASE_URL}/unsubscribe/${token}`,
        );

        if (response.data.success && response.data.data) {
          setInfo(response.data.data);
        } else {
          setError('Invalid or expired unsubscribe link');
        }
      } catch (err: any) {
        const status = err.response?.status;
        const errorData = err.response?.data;

        if (status === 400 || errorData?.code === 'INVALID_TOKEN' || errorData?.code === 'VALIDATION_ERROR') {
          setError('This unsubscribe link is no longer valid. Please contact the store or try again from a more recent message.');
        } else {
          setError('Failed to load unsubscribe information. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInfo();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await axios.post<{ success: boolean; data: { success: boolean; message: string } }>(
        `${SHOPIFY_API_BASE_URL}/unsubscribe/${token}`,
      );

      if (response.data.success && response.data.data?.success) {
        setConfirmed(true);
      } else {
        setSubmitError('Failed to unsubscribe. Please try again.');
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      const message = errorData?.message || 'Failed to unsubscribe. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
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
    return (
      <PublicLayout>
        <PublicCard>
          <PublicError
            title="Invalid Link"
            message={error}
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  if (confirmed) {
    return (
      <PublicLayout>
        <PublicCard>
          <PublicSuccess
            title="Unsubscribed"
            message={
              info?.shop?.shopName
                ? `You have been unsubscribed from SMS messages from ${info.shop.shopName}.`
                : 'You have been unsubscribed from SMS messages.'
            }
          />
        </PublicCard>
      </PublicLayout>
    );
  }

  const storeName = info?.shop?.shopName || info?.shop?.shopDomain?.replace('.myshopify.com', '') || 'this store';
  const contactName = info?.contact?.firstName
    ? `${info.contact.firstName}${info.contact.lastName ? ` ${info.contact.lastName}` : ''}`
    : null;

  // Benefits section - what they lose by unsubscribing
  const benefits = [
    'Exclusive discounts and promotions',
    'Early access to sales and new products',
    'Order updates and shipping notifications',
    'Personalized product recommendations',
  ];

  return (
    <PublicLayout>
      <PublicCard>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Unsubscribe</h1>
          <p className="text-sm text-text-secondary mb-6">
            {contactName ? `Hi ${contactName}, ` : ''}Do you want to stop receiving SMS messages
            from <strong>{storeName}</strong>?
          </p>

          {/* Benefits section - what they lose */}
          <div className="mb-6 text-left bg-surface-light rounded-lg p-4 border border-border">
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              You&apos;ll miss out on:
            </h3>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              {benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {submitError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{submitError}</p>
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleUnsubscribe}
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Processing...' : 'Yes, Unsubscribe Me'}
            </Button>
            <p className="text-xs text-text-tertiary">
              You can resubscribe at any time by contacting the store.
            </p>
          </div>
        </div>
      </PublicCard>
    </PublicLayout>
  );
}

export default function ShopifyUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <PublicLayout>
          <PublicCard>
            <PublicLoading message="Loading..." />
          </PublicCard>
        </PublicLayout>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}

