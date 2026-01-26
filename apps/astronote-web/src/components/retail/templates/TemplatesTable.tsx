'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Eye, Edit, Trash2, Copy, CopyCheck } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateTypeBadge } from './TemplateTypeBadge';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { RetailCard } from '@/src/components/retail/RetailCard';
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
  onCopy?: (_template: Template) => void
}

export function TemplatesTable({
  templates,
  systemUserId = 1,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
  onCopy,
}: TemplatesTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.text || '');
      setCopiedId(template.id);
      toast.success('Template text copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
      if (onCopy) {
        onCopy(template);
      }
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <RetailCard>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(template)}
                            className="h-8 w-8 p-0"
                            title="Copy text to clipboard"
                          >
                            {copiedId === template.id ? (
                              <CopyCheck className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
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
        </RetailCard>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {templates.map((template) => {
          const isSystem = template.ownerId === systemUserId;
          const previewText = template.text?.substring(0, 150) || '';

          return (
            <RetailCard key={template.id} hover className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-text-primary">{template.name}</h3>
                    {template.goal && (
                      <p className="text-xs text-text-secondary mt-1">{template.goal}</p>
                    )}
                  </div>
                  <TemplateTypeBadge ownerId={template.ownerId} systemUserId={systemUserId} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-text-secondary">
                    {CATEGORY_LABELS[template.category || ''] || template.category}
                  </span>
                  <span className="text-text-secondary">
                    {LANGUAGE_LABELS[template.language || 'en'] || template.language}
                  </span>
                  {template.updatedAt && (
                    <span className="text-text-tertiary">
                      {format(new Date(template.updatedAt), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-secondary bg-surface-light rounded p-2">
                  {previewText}
                  {(template.text?.length || 0) > 150 && '...'}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreview(template)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(template)}
                    className="flex-1"
                  >
                    {copiedId === template.id ? (
                      <>
                        <CopyCheck className="w-4 h-4 mr-2 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  {isSystem ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDuplicate(template)}
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(template)}
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(template)}
                        className="flex-1 text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </RetailCard>
          );
        })}
      </div>

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
