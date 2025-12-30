'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/src/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRenderTemplate } from '@/src/features/retail/templates/hooks/useRenderTemplate';
import type { Template } from '@/src/lib/retail/api/templates';

const SUPPORTED_PLACEHOLDERS = [
  { name: '{{first_name}}', description: 'Contact&apos;s first name' },
  { name: '{{last_name}}', description: 'Contact&apos;s last name' },
  { name: '{{email}}', description: 'Contact&apos;s email' },
];

interface TemplatePreviewModalProps {
  open: boolean
  onClose: () => void
  template?: Template | null
  systemUserId?: number
}

export function TemplatePreviewModal({
  open,
  onClose,
  template,
  systemUserId = 1,
}: TemplatePreviewModalProps) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  if (!open || !template) return null;

  const isSystem = template.ownerId === systemUserId;
  const textLength = template.text?.length || 0;
  const estimatedParts = Math.ceil(textLength / 160);

  return (
    <Dialog open={open} onClose={onClose} title="Template Preview" size="xl">
      <div className="space-y-6">
        {/* Template Info */}
        <div>
          <h3 className="text-lg font-medium text-text-primary mb-2">{template.name}</h3>
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>Category: {template.category}</span>
            <span>Language: {template.language}</span>
            <span>Type: {isSystem ? 'System' : 'My Template'}</span>
          </div>
          {template.goal && <p className="mt-2 text-sm text-text-secondary">{template.goal}</p>}
        </div>

        {/* Original Template Text */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">Template Text</h4>
          <div className="bg-surface-light border border-border rounded-md p-4">
            <pre className="whitespace-pre-wrap text-sm text-text-primary font-mono">
              {template.text}
            </pre>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
            <span>{textLength} characters</span>
            {textLength > 160 && <span>~{estimatedParts} SMS parts</span>}
          </div>
        </div>

        {/* Sample Contact Input */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">Preview with Sample Data</h4>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">First Name</label>
              <Input
                type="text"
                value={sampleContact.firstName}
                onChange={(e) =>
                  setSampleContact({ ...sampleContact, firstName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Last Name</label>
              <Input
                type="text"
                value={sampleContact.lastName}
                onChange={(e) =>
                  setSampleContact({ ...sampleContact, lastName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Email</label>
              <Input
                type="email"
                value={sampleContact.email}
                onChange={(e) =>
                  setSampleContact({ ...sampleContact, email: e.target.value })
                }
              />
            </div>
          </div>
          <Button
            onClick={() =>
              renderMutation.mutate({
                templateId: template.id,
                contact: sampleContact,
              })
            }
            disabled={renderMutation.isPending}
            size="sm"
          >
            {renderMutation.isPending ? 'Rendering...' : 'Update Preview'}
          </Button>
        </div>

        {/* Rendered Preview */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">Rendered Preview</h4>
          {renderMutation.isPending ? (
            <div className="bg-surface-light border border-border rounded-md p-4 text-center">
              <p className="text-sm text-text-secondary">Rendering template...</p>
            </div>
          ) : renderMutation.error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-400">
                {(renderMutation.error as any)?.response?.data?.message || 'Failed to render template'}
              </p>
            </div>
          ) : renderMutation.data ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <pre className="whitespace-pre-wrap text-sm text-text-primary font-mono">
                {renderMutation.data.text}
              </pre>
            </div>
          ) : (
            <div className="bg-surface-light border border-border rounded-md p-4">
              <p className="text-sm text-text-secondary">Click &quot;Update Preview&quot; to render template</p>
            </div>
          )}
        </div>

        {/* Supported Placeholders */}
        <div>
          <h4 className="text-sm font-medium text-text-secondary mb-2">Supported Placeholders</h4>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <ul className="space-y-2">
              {SUPPORTED_PLACEHOLDERS.map((ph) => (
                <li key={ph.name} className="text-sm">
                  <code className="bg-blue-100 px-2 py-1 rounded text-blue-800">{ph.name}</code>
                  <span className="ml-2 text-text-secondary">{ph.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

