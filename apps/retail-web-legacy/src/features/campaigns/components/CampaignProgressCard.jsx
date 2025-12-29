import { format } from 'date-fns';

export default function CampaignProgressCard({ campaign, metrics }) {
  if (!metrics) return null;

  const { queued, success, processed, failed } = metrics;
  const total = campaign.total || 0;
  const sentProgress = total > 0 ? (success / total) * 100 : 0;
  const processedProgress = total > 0 ? (processed / total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Progress</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Total Recipients</span>
            <span className="font-medium">{total.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, processedProgress)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Queued</div>
            <div className="text-2xl font-bold text-gray-900">{queued.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Sent</div>
            <div className="text-2xl font-bold text-green-600">{success.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Failed</div>
            <div className="text-2xl font-bold text-red-600">{failed.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Processed</div>
            <div className="text-2xl font-bold text-blue-600">{processed.toLocaleString()}</div>
          </div>
        </div>

        {campaign.scheduledAt && campaign.status === 'scheduled' && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">Scheduled for</div>
            <div className="text-lg font-medium text-gray-900">
              {format(new Date(campaign.scheduledAt), 'PPpp')}
            </div>
          </div>
        )}

        {campaign.startedAt && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">Started at</div>
            <div className="text-lg font-medium text-gray-900">
              {format(new Date(campaign.startedAt), 'PPpp')}
            </div>
          </div>
        )}

        {campaign.finishedAt && (
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">Finished at</div>
            <div className="text-lg font-medium text-gray-900">
              {format(new Date(campaign.finishedAt), 'PPpp')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

