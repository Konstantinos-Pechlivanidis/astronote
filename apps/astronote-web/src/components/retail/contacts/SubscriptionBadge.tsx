import { CheckCircle, XCircle } from 'lucide-react';

interface SubscriptionBadgeProps {
  isSubscribed?: boolean
}

export function SubscriptionBadge({ isSubscribed }: SubscriptionBadgeProps) {
  if (isSubscribed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3" />
        Subscribed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <XCircle className="w-3 h-3" />
      Unsubscribed
    </span>
  );
}

