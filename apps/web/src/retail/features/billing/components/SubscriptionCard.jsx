import { CheckCircle, XCircle } from 'lucide-react';
import { useSubscribe } from '../hooks/useSubscribe';
import { useCustomerPortal } from '../hooks/useCustomerPortal';
import { useState } from 'react';

export default function SubscriptionCard({ subscription }) {
  const subscribeMutation = useSubscribe();
  const portalMutation = useCustomerPortal();
  const [selectedPlan, setSelectedPlan] = useState(null);

  const isActive = subscription?.active === true;
  const currentPlan = subscription?.planType;

  const handleSubscribe = (planType) => {
    setSelectedPlan(planType);
    subscribeMutation.mutate({ planType });
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  if (isActive) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Current Subscription: {currentPlan ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) : 'Active'}
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          You have an active subscription. You can manage your subscription, update your plan, or cancel
          from the customer portal.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleManageSubscription}
            disabled={portalMutation.isPending}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <XCircle className="w-5 h-5 text-red-600" />
        <h3 className="text-lg font-semibold text-gray-900">Subscribe to a Plan</h3>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Choose a subscription plan to start sending campaigns. All plans include monthly credit
        allocations.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Starter Plan</h4>
          <p className="text-sm text-gray-600 mb-4">Perfect for small businesses</p>
          <button
            onClick={() => handleSubscribe('starter')}
            disabled={subscribeMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subscribeMutation.isPending && selectedPlan === 'starter'
              ? 'Processing...'
              : 'Subscribe to Starter'}
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Pro Plan</h4>
          <p className="text-sm text-gray-600 mb-4">For growing businesses</p>
          <button
            onClick={() => handleSubscribe('pro')}
            disabled={subscribeMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {subscribeMutation.isPending && selectedPlan === 'pro'
              ? 'Processing...'
              : 'Subscribe to Pro'}
          </button>
        </div>
      </div>
    </div>
  );
}

