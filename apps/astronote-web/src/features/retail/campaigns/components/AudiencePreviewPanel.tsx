'use client';

import { useState } from 'react';
import { Users, AlertCircle, Eye } from 'lucide-react';
import { maskPhone } from '@/src/lib/retail/phone';
import { usePreviewAudience } from '../hooks/usePreviewAudience';
import { Button } from '@/components/ui/button';

interface AudiencePreviewPanelProps {
  filters: {
    filterGender?: string | null
    filterAgeGroup?: string | null
    nameSearch?: string | null
  }
  onCountResolved?: (_count: number) => void
}

export function AudiencePreviewPanel({ filters, onCountResolved }: AudiencePreviewPanelProps) {
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const previewMutation = usePreviewAudience();

  const handlePreview = () => {
    if (previewMutation.isPending) {
      return;
    }

    const payload = {
      filterGender: filters.filterGender && filters.filterGender.trim() ? filters.filterGender : null,
      filterAgeGroup: filters.filterAgeGroup && filters.filterAgeGroup.trim() ? filters.filterAgeGroup : null,
      nameSearch: filters.nameSearch || null,
    };

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
        <Button type="button" onClick={handlePreview} disabled={isLoading}>
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Previewing...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Preview Audience
            </>
          )}
        </Button>
        <p className="mt-2 text-xs text-text-tertiary">
          Preview shows how many contacts match your filters. Filters are optional.
        </p>
      </div>

      {/* Results Panel */}
      {(hasPreviewed || isLoading || error) && (
        <div>
          {isLoading && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent"></div>
                <span className="text-sm text-blue-400">Calculating audience...</span>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <span className="text-sm text-red-400">
                    {(error as any)?.response?.data?.message || 'Failed to preview audience'}
                  </span>
                  <button
                    type="button"
                    onClick={handlePreview}
                    className="ml-3 text-sm text-red-400 underline hover:text-red-300"
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
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-400 mb-1">No recipients found</p>
                      <p className="text-xs text-yellow-400/80">
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
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-accent" />
                    <span className="text-sm font-medium text-blue-400">
                      {data.count.toLocaleString()} {data.count === 1 ? 'recipient' : 'recipients'} will
                      receive this campaign
                    </span>
                  </div>
                  {data.preview && data.preview.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-blue-400 mb-2">
                        Preview (first {data.preview.length}):
                        {data.hasMore && <span className="text-accent ml-1">(showing sample)</span>}
                      </p>
                      <div className="space-y-1">
                        {data.preview.map((contact, idx) => (
                          <div
                            key={contact.id || contact.phone || idx}
                            className="text-xs text-blue-400/80 bg-surface rounded px-2 py-1"
                          >
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

