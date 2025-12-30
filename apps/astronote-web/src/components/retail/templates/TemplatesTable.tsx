'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, Edit, Trash2, Copy } from 'lucide-react';
import { TemplateTypeBadge } from './TemplateTypeBadge';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import type { Template } from '@/src/lib/retail/api/templates';

const CATEGORY_LABELS: Record<string, string> = {
  generic: 'Generic',
  cafe: 'Cafe',
  restaurant: 'Restaurant',
  gym: 'Gym',
  sports_club: 'Sports Club',
  hotels: 'Hotels',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  gr: 'Greek',
};

interface TemplatesTableProps {
  templates: Template[]
  systemUserId?: number
  onPreview: (_template: Template) => void
  onEdit: (_template: Template) => void
  onDelete: (_id: number) => void
  onDuplicate: (_template: Template) => void
}

export function TemplatesTable({
  templates,
  systemUserId = 1,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
}: TemplatesTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <>
      <GlassCard>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => {
                const isSystem = template.ownerId === systemUserId;
                const previewText = template.text?.substring(0, 100) || '';
                const hasMore = (template.text?.length || 0) > 100;

                return (
                  <tr key={template.id} className="hover:bg-surface">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-text-primary">{template.name}</div>
                      {template.goal && (
                        <div className="text-xs text-text-secondary mt-1">{template.goal}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">
                        {CATEGORY_LABELS[template.category || ''] || template.category}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-primary">
                        {LANGUAGE_LABELS[template.language || 'en'] || template.language}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TemplateTypeBadge ownerId={template.ownerId} systemUserId={systemUserId} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-secondary max-w-md">
                        {previewText}
                        {hasMore && '...'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary">
                        {template.updatedAt
                          ? format(new Date(template.updatedAt), 'MMM d, yyyy')
                          : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPreview(template)}
                          className="h-8 w-8 p-0"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isSystem ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDuplicate(template)}
                            className="h-8 w-8 p-0"
                            title="Duplicate to My Templates"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(template)}
                              className="h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(template)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
      </GlassCard>

      {deleteConfirm && (
        <ConfirmDialog
          open={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (deleteConfirm) {
              onDelete(deleteConfirm.id);
              setDeleteConfirm(null);
            }
          }}
          title="Delete Template"
          message={`Are you sure you want to delete &quot;${deleteConfirm.name}&quot;? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </>
  );
}

