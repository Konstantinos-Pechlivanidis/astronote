import { useState } from 'react';
import { Edit, Mail, Calendar } from 'lucide-react';
import { useToggleAutomation } from '../api/automations.queries';
import { useBillingGate } from '../../billing/hooks/useBillingGate';
import AutomationEditorModal from './AutomationEditorModal';
import StatusBadge from '../../../components/common/StatusBadge';

const AUTOMATION_INFO = {
  welcome_message: {
    name: 'Welcome Message',
    description: 'Automatically sends a welcome message when a new contact is added',
    icon: Mail,
    trigger: 'New contact added',
  },
  birthday_message: {
    name: 'Birthday Message',
    description: 'Automatically sends a birthday message on the contact\'s birthday',
    icon: Calendar,
    trigger: 'Contact birthday',
  },
};

export default function AutomationCard({ automation }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const toggleMutation = useToggleAutomation();
  const billingGate = useBillingGate();

  if (!automation) return null;

  const info = AUTOMATION_INFO[automation.type];
  const Icon = info?.icon || Mail;
  const stats = automation.stats || { total: 0, sent: 0, conversions: 0, conversionRate: 0 };

  const handleToggle = () => {
    // Prevent toggle if mutation is already pending or subscription inactive
    if (toggleMutation.isPending) return;
    if (!billingGate.canSendCampaigns) {
      // Show toast or handle billing gate
      return;
    }

    toggleMutation.mutate({
      type: automation.type,
      isActive: !automation.isActive,
    });
  };

  const canToggle = billingGate.canSendCampaigns;

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{info?.name || automation.type}</h3>
              <p className="text-sm text-gray-600 mt-1">{info?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={automation.isActive ? 'active' : 'inactive'} />
            <button
              onClick={handleToggle}
              disabled={toggleMutation.isPending || !canToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                automation.isActive ? 'bg-blue-600' : 'bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={
                !canToggle
                  ? 'Subscription required to enable automations'
                  : automation.isActive
                    ? 'Disable automation'
                    : 'Enable automation'
              }
              title={
                !canToggle
                  ? 'Subscription required to enable automations'
                  : automation.isActive
                    ? 'Disable automation'
                    : 'Enable automation'
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  automation.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Trigger:</p>
          <p className="text-sm text-gray-700">{info?.trigger || 'System event'}</p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Message:</p>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{automation.messageBody || '—'}</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500">Total Sent</p>
              <p className="text-lg font-semibold text-gray-900">{stats.sent || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Conversions</p>
              <p className="text-lg font-semibold text-gray-900">{stats.conversions || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Conversion Rate</p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.conversionRate ? `${(stats.conversionRate * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Message
          </button>
        </div>
      </div>

      {isEditorOpen && (
        <AutomationEditorModal
          automation={automation}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </>
  );
}

