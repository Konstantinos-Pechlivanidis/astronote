import { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { useRenderTemplate } from '../hooks/useRenderTemplate';
import LoadingState from '../../../components/common/LoadingState';

const SUPPORTED_PLACEHOLDERS = [
  { name: '{{first_name}}', description: "Contact's first name" },
  { name: '{{last_name}}', description: "Contact's last name" },
  { name: '{{email}}', description: "Contact's email" },
];

export default function TemplatePreviewModal({ open, onClose, template, systemUserId = 1 }) {
  const [sampleContact, setSampleContact] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
  });

  const renderMutation = useRenderTemplate();

  useEffect(() => {
    if (open && template) {
      renderMutation.mutate({
        templateId: template.id,
        contact: sampleContact,
      });
    }
  }, [open, template]);

  if (!open || !template) return null;

  const isSystem = template.ownerId === systemUserId;
  const textLength = template.text?.length || 0;
  const estimatedParts = Math.ceil(textLength / 160);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Template Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Template Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{template.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Category: {template.category}</span>
                <span>Language: {template.language}</span>
                <span>Type: {isSystem ? 'System' : 'My Template'}</span>
              </div>
              {template.goal && (
                <p className="mt-2 text-sm text-gray-600">{template.goal}</p>
              )}
            </div>

            {/* Original Template Text */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Template Text</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {template.text}
                </pre>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{textLength} characters</span>
                {textLength > 160 && <span>~{estimatedParts} SMS parts</span>}
              </div>
            </div>

            {/* Sample Contact Input */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Preview with Sample Data</h4>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">First Name</label>
                  <input
                    type="text"
                    value={sampleContact.firstName}
                    onChange={(e) =>
                      setSampleContact({ ...sampleContact, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={sampleContact.lastName}
                    onChange={(e) =>
                      setSampleContact({ ...sampleContact, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={sampleContact.email}
                    onChange={(e) =>
                      setSampleContact({ ...sampleContact, email: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  renderMutation.mutate({
                    templateId: template.id,
                    contact: sampleContact,
                  })
                }
                disabled={renderMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {renderMutation.isPending ? 'Rendering...' : 'Update Preview'}
              </button>
            </div>

            {/* Rendered Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Rendered Preview</h4>
              {renderMutation.isPending ? (
                <LoadingState message="Rendering template..." />
              ) : renderMutation.error ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">
                    {renderMutation.error.response?.data?.message || 'Failed to render template'}
                  </p>
                </div>
              ) : renderMutation.data ? (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                    {renderMutation.data.renderedText}
                  </pre>
                  {renderMutation.data.usedPlaceholders?.length > 0 && (
                    <div className="mt-3 text-xs text-gray-600">
                      <p className="font-medium mb-1">Used placeholders:</p>
                      <ul className="list-disc list-inside">
                        {renderMutation.data.usedPlaceholders.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {renderMutation.data.missingPlaceholders?.length > 0 && (
                    <div className="mt-2 text-xs text-yellow-600">
                      <p className="font-medium mb-1">Missing placeholders:</p>
                      <ul className="list-disc list-inside">
                        {renderMutation.data.missingPlaceholders.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <p className="text-sm text-gray-500">Click "Update Preview" to render template</p>
                </div>
              )}
            </div>

            {/* Supported Placeholders */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Supported Placeholders</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <ul className="space-y-2">
                  {SUPPORTED_PLACEHOLDERS.map((ph) => (
                    <li key={ph.name} className="text-sm">
                      <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{ph.name}</code>
                      <span className="ml-2 text-gray-600">{ph.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Stats (for system templates) */}
            {isSystem && template.conversionRate !== null && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Benchmark Statistics</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {template.conversionRate !== null && (
                      <div>
                        <span className="text-gray-600">Conversion Rate:</span>{' '}
                        <span className="font-medium">{(template.conversionRate * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    {template.clickThroughRate !== null && (
                      <div>
                        <span className="text-gray-600">Click-Through Rate:</span>{' '}
                        <span className="font-medium">{(template.clickThroughRate * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

