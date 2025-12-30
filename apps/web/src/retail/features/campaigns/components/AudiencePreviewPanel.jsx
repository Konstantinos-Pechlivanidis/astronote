import { useState } from 'react';
import { Users, AlertCircle, Eye } from 'lucide-react';
import { maskPhone } from '../../../lib/phone';
import { usePreviewAudience } from '../hooks/usePreviewAudience';
import { preparePreviewPayload } from '../lib/audienceFilters';

/**
 * AudiencePreviewPanel - Shared component for previewing campaign audience
 *
 * @param {Object} props
 * @param {Object} props.filters - Filter values { filterGender, filterAgeGroup, nameSearch? }
 * @param {Function} props.onCountResolved - Optional callback when count is resolved (count) => void
 */
export default function AudiencePreviewPanel({ filters, onCountResolved }) {
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const previewMutation = usePreviewAudience();

  const handlePreview = () => {
    // Prevent double-click
    if (previewMutation.isPending) {
      return;
    }

    const payload = preparePreviewPayload(filters);

    previewMutation.mutate(payload, {
      onSuccess: (data) => {
        setHasPreviewed(true);
        if (onCountResolved && typeof onCountResolved === 'function') {
          onCountResolved(data.count);
        }
      },
    });
  };

  const data = previewMutation.data;
  const isLoading = previewMutation.isPending;
  const error = previewMutation.error;

  return (
    <div className="space-y-4">
      {/* Preview Button */}
      <div>
        <button
          type="button"
          onClick={handlePreview}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Previewing...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Preview Audience
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Preview shows how many contacts match your filters. Filters are optional.
        </p>
      </div>

      {/* Results Panel */}
      {(hasPreviewed || isLoading || error) && (
        <div>
          {isLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-700">Calculating audience...</span>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <span className="text-sm text-red-700">
                    {error.response?.data?.message || 'Failed to preview audience'}
                  </span>
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="ml-3 text-sm text-red-800 underline hover:text-red-900"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {data && !isLoading && !error && (
            <>
              {data.count === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 mb-1">No recipients found</p>
                      <p className="text-xs text-yellow-700">
                        This could be because:
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>No contacts are subscribed</li>
                          <li>Age restrictions exclude all contacts</li>
                          <li>Gender filter is too restrictive</li>
                        </ul>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      {data.count.toLocaleString()} {data.count === 1 ? 'recipient' : 'recipients'} will receive this campaign
                    </span>
                  </div>
                  {data.preview && data.preview.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-blue-800 mb-2">
                        Preview (first {data.preview.length}):
                        {data.hasMore && <span className="text-blue-600 ml-1">(showing sample)</span>}
                      </p>
                      <div className="space-y-1">
                        {data.preview.map((contact) => (
                          <div key={contact.id || contact.phone} className="text-xs text-blue-700 bg-white rounded px-2 py-1">
                            {contact.firstName || contact.lastName
                              ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                              : '—'}{' '}
                            ({maskPhone(contact.phone)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

