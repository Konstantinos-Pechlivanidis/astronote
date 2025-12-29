import { X } from 'lucide-react';
import TemplateForm from './TemplateForm';

export default function TemplateFormModal({ open, onClose, template, onSubmit, isLoading, systemUserId = 1 }) {
  if (!open) return null;

  const isSystem = template && template.ownerId === systemUserId;
  const isEdit = !!template && !isSystem;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {isSystem ? 'View System Template' : isEdit ? 'Edit Template' : 'Create Template'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <TemplateForm
            template={template}
            onSubmit={(data) => {
              onSubmit(data);
              // onClose will be called by parent on success
            }}
            isLoading={isLoading}
            systemUserId={systemUserId}
          />
        </div>
      </div>
    </div>
  );
}

