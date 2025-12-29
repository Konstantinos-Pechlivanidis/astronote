import { format } from 'date-fns';
import { Eye, Edit, Trash2, Copy } from 'lucide-react';
import TemplateTypeBadge from './TemplateTypeBadge';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { useState } from 'react';

const CATEGORY_LABELS = {
  generic: 'Generic',
  cafe: 'Cafe',
  restaurant: 'Restaurant',
  gym: 'Gym',
  sports_club: 'Sports Club',
  hotels: 'Hotels',
};

const LANGUAGE_LABELS = {
  en: 'English',
  gr: 'Greek',
};

export default function TemplatesTable({
  templates,
  systemUserId = 1,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => {
                const isSystem = template.ownerId === systemUserId;
                const previewText = template.text?.substring(0, 100) || '';
                const hasMore = (template.text?.length || 0) > 100;

                return (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{template.name}</div>
                      {template.goal && (
                        <div className="text-xs text-gray-500 mt-1">{template.goal}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {LANGUAGE_LABELS[template.language] || template.language}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TemplateTypeBadge ownerId={template.ownerId} systemUserId={systemUserId} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-md">
                        {previewText}
                        {hasMore && '...'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {template.updatedAt
                          ? format(new Date(template.updatedAt), 'MMM d, yyyy')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onPreview(template)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isSystem ? (
                          <button
                            onClick={() => onDuplicate(template)}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="Duplicate to My Templates"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onEdit(template)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(template)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirm && (
        <ConfirmDialog
          open={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            onDelete(deleteConfirm.id);
            setDeleteConfirm(null);
          }}
          title="Delete Template"
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          confirmText="Delete"
          confirmClass="bg-red-600 hover:bg-red-700"
        />
      )}
    </>
  );
}

