'use client';

import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useTemplates } from '@/src/features/retail/templates/hooks/useTemplates';
import { useCreateTemplate } from '@/src/features/retail/templates/hooks/useCreateTemplate';
import { useUpdateTemplate } from '@/src/features/retail/templates/hooks/useUpdateTemplate';
import { useDeleteTemplate } from '@/src/features/retail/templates/hooks/useDeleteTemplate';
import { TemplatesToolbar } from '@/src/components/retail/templates/TemplatesToolbar';
import { TemplatesTable } from '@/src/components/retail/templates/TemplatesTable';
import { TemplateFormModal } from '@/src/components/retail/templates/TemplateFormModal';
import { TemplatePreviewModal } from '@/src/components/retail/templates/TemplatePreviewModal';
import { TemplatesSkeleton } from '@/src/components/retail/templates/TemplatesSkeleton';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import type { Template } from '@/src/lib/retail/api/templates';
import type { z } from 'zod';
import { templateSchema } from '@/src/lib/retail/validators';

// System User ID (default: 1, should ideally come from backend/config)
const SYSTEM_USER_ID = 1;

export default function TemplatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState<'en' | 'gr'>('en');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState<'system' | 'my'>('system');
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const pageSize = 50;

  const { data, isLoading, error, refetch } = useTemplates({
    language,
    page,
    pageSize,
    q: search,
    category: category || undefined,
    tab,
  });

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const handleAddClick = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const handleEdit = (template: Template) => {
    // Only allow editing user templates
    if (template.ownerId === SYSTEM_USER_ID) {
      return; // System templates cannot be edited
    }
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleDuplicate = (template: Template) => {
    // Prefill form with system template data for duplication
    setEditingTemplate({
      ...template,
      name: `${template.name} (Copy)`,
      ownerId: undefined, // Will be set to user.id on create
    });
    setFormOpen(true);
  };

  const handleFormSubmit = (formData: z.infer<typeof templateSchema>) => {
    if (editingTemplate && editingTemplate.id && editingTemplate.ownerId !== SYSTEM_USER_ID) {
      // Update existing user template
      updateMutation.mutate(
        { id: editingTemplate.id, data: formData },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingTemplate(null);
          },
        },
      );
    } else {
      // Create new template (from scratch or duplicate)
      createMutation.mutate(
        {
          ...formData,
          language, // Use current language selection
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingTemplate(null);
            // Switch to "My Templates" tab to show the new template
            setTab('my');
          },
        },
      );
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTemplate(null);
  };

  // Reset to page 1 when filters change
  const handleTabChange = (newTab: 'system' | 'my') => {
    setTab(newTab);
    setPage(1);
  };

  const handleLanguageChange = (newLanguage: 'en' | 'gr') => {
    setLanguage(newLanguage);
    setPage(1);
  };

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-8 h-8 text-accent" />
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Templates</h1>
          <p className="text-sm text-text-secondary mt-1">
            Browse system templates and manage your custom message templates
          </p>
        </div>
      </div>

      <TemplatesToolbar
        search={search}
        onSearchChange={setSearch}
        language={language}
        onLanguageChange={handleLanguageChange}
        category={category}
        onCategoryChange={handleCategoryChange}
        tab={tab}
        onTabChange={handleTabChange}
        onAddClick={handleAddClick}
      />

      {isLoading && <TemplatesSkeleton />}

      {error && (
        <GlassCard>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">Error loading templates</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        </GlassCard>
      )}

      {!isLoading && !error && data && (
        <>
          {data.items && data.items.length > 0 ? (
            <>
              <TemplatesTable
                templates={data.items}
                systemUserId={SYSTEM_USER_ID}
                onPreview={handlePreview}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                  {data.total} templates
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= data.total}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <GlassCard>
              <EmptyState
                icon={FileText}
                title={
                  search || category
                    ? 'No templates found'
                    : tab === 'my'
                      ? 'No custom templates yet'
                      : 'No system templates available'
                }
                description={
                  search || category
                    ? 'Try adjusting your filters'
                    : tab === 'my'
                      ? 'Create your first template to get started. You can also duplicate system templates to customize them.'
                      : 'System templates will appear here when available.'
                }
                action={
                  !search && !category && tab === 'my' && (
                    <Button onClick={handleAddClick} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Template
                    </Button>
                  )
                }
              />
            </GlassCard>
          )}
        </>
      )}

      <TemplateFormModal
        open={formOpen}
        onClose={handleCloseForm}
        template={editingTemplate}
        onSubmit={handleFormSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        systemUserId={SYSTEM_USER_ID}
      />

      <TemplatePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        template={previewTemplate}
        systemUserId={SYSTEM_USER_ID}
      />
    </div>
  );
}
