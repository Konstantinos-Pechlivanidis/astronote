import { X } from 'lucide-react';

export default function MessagePreviewModal({ open, onClose, messages, isLoading }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Message Preview</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Loading preview...</p>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Showing first {messages.length} rendered messages:
              </p>
              {messages.map((msg, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">To: {msg.to}</div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600">No messages to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

