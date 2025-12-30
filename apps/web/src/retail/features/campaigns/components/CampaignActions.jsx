import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Eye, BarChart3, Calendar, XCircle } from 'lucide-react';
import { useBillingGate } from '../../billing/hooks/useBillingGate';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { useEnqueueCampaign } from '../hooks/useEnqueueCampaign';

export default function CampaignActions({ campaign, onPreviewMessages, onViewStatus, onViewStats }) {
  const navigate = useNavigate();
  const billingGate = useBillingGate();
  const enqueueMutation = useEnqueueCampaign();
  const [enqueueConfirm, setEnqueueConfirm] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);

  // CRITICAL FIX: Check status AND mutation state to prevent double-clicks
  // After enqueue starts, campaign.status will change to 'sending', but we also check mutation state
  const canEnqueue = ['draft', 'scheduled', 'paused'].includes(campaign.status) && !enqueueMutation.isPending && !isEnqueuing;
  const canEdit = ['draft', 'scheduled'].includes(campaign.status);
  const subscriptionInactive = !billingGate.canSendCampaigns;

  const handleEnqueue = () => {
    if (subscriptionInactive) {
      return; // Button should be disabled, but just in case
    }
    setEnqueueConfirm(true);
  };

  const handleConfirmEnqueue = () => {
    // P0 FIX: Prevent double-click with multiple guards
    if (isEnqueuing || enqueueMutation.isPending) {
      return;
    }

    // Close confirm dialog immediately to prevent multiple clicks
    setEnqueueConfirm(false);
    setIsEnqueuing(true);

    enqueueMutation.mutate({ id: campaign.id, status: campaign.status }, {
      onSuccess: () => {
        setIsEnqueuing(false);
        // Invalidate and refetch will update the UI
      },
      onError: () => {
        setIsEnqueuing(false);
        // Re-open confirm dialog on error so user can retry
        // Don't re-open if it was a validation error (e.g., already sending)
      },
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {/* CRITICAL FIX: Always show button, but disable and show loading state when sending */}
        <button
          onClick={handleEnqueue}
          disabled={subscriptionInactive || isEnqueuing || enqueueMutation.isPending || !canEnqueue}
          className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
            subscriptionInactive || !canEnqueue || isEnqueuing || enqueueMutation.isPending
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={
            subscriptionInactive
              ? 'Active subscription required to send campaigns. Please subscribe in Billing.'
              : !canEnqueue
                ? 'Campaign is already being sent'
                : isEnqueuing || enqueueMutation.isPending
                  ? 'Sending campaign...'
                  : 'Send this campaign'
          }
        >
          <Send className="w-4 h-4" />
          {isEnqueuing || enqueueMutation.isPending ? 'Sending...' : 'Send Campaign'}
        </button>

        <button
          onClick={onPreviewMessages}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Preview Messages
        </button>

        {campaign.status === 'sending' || campaign.status === 'scheduled' ? (
          <button
            onClick={onViewStatus}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            View Status
          </button>
        ) : null}

        {['completed', 'failed'].includes(campaign.status) && (
          <button
            onClick={onViewStats}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            View Stats
          </button>
        )}

        {canEdit && (
          <button
            onClick={() => navigate(`/app/campaigns/${campaign.id}/edit`)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {subscriptionInactive && canEnqueue && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {billingGate.reason || 'Active subscription required to send campaigns'}
              </p>
              <p className="text-xs text-red-700 mt-1">
                <button
                  onClick={() => navigate(billingGate.ctaTarget || '/app/billing')}
                  className="underline hover:no-underline"
                >
                  Go to Billing
                </button>{' '}
                to subscribe and start sending campaigns.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={enqueueConfirm}
        onClose={() => setEnqueueConfirm(false)}
        onConfirm={handleConfirmEnqueue}
        title="Send Campaign"
        message={
          campaign.total
            ? `This will send the campaign to ${campaign.total.toLocaleString()} recipients. Continue?`
            : 'This will send the campaign. Continue?'
        }
        confirmText="Send"
        cancelText="Cancel"
        variant="default"
      />
    </>
  );
}

