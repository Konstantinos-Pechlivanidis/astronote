import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../../components/common/StatusBadge';

export default function CampaignsTable({ campaigns }) {
  const navigate = useNavigate();

  if (!campaigns || campaigns.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Messages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <tr
                key={campaign.id}
                onClick={() => navigate(`/app/campaigns/${campaign.id}`)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {campaign.stats ? (
                    <div className="text-sm text-gray-900">
                      <span>Total: {campaign.stats.total || 0}</span>
                      {campaign.stats.sent > 0 && (
                        <span className="ml-2 text-green-600">Sent: {campaign.stats.sent}</span>
                      )}
                      {campaign.stats.failed > 0 && (
                        <span className="ml-2 text-red-600">Failed: {campaign.stats.failed}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {campaign.scheduledAt
                      ? format(new Date(campaign.scheduledAt), 'MMM d, yyyy HH:mm')
                      : '—'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {campaign.createdAt ? format(new Date(campaign.createdAt), 'MMM d, yyyy') : '—'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

