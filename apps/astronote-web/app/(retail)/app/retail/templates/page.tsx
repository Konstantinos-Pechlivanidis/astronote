'use client';

import { useMemo, useState } from 'react';
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
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { Button } from '@/components/ui/button';
import type { Template } from '@/src/lib/retail/api/templates';
import type { z } from 'zod';
import { templateSchema } from '@/src/lib/retail/validators';

/**
 * Determine system user ID from template data.
 * NOTE: This is a fallback heuristic. Ideally the backend should return `isSystem`.
 */
function getSystemUserId(templates: Template[]): number | null {
  if (!templates?.length) return null;

  const ownerCounts = new Map<number, number>();
  for (const t of templates) {
    if (typeof t.ownerId !== 'number') continue;
    ownerCounts.set(t.ownerId, (ownerCounts.get(t.ownerId) || 0) + 1);
  }

  let maxCount = 0;
  let systemUserId: number | null = null;
  ownerCounts.forEach((count, ownerId) => {
    if (count > maxCount) {
      maxCount = count;
      systemUserId = ownerId;
    }
  });

  return systemUserId;
}

/**
 * We must NOT pass empty string values to Select items.
 * Use a sentinel for "all".
 */
const ALL_CATEGORY = 'all';

export default function TemplatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // ✅ IMPORTANT: never use '' for Select values.
  const [category, setCategory] = useState<string>(ALL_CATEGORY);

  const [tab, setTab] = useState<'system' | 'my'>('system');

  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const pageSize = 50;

  // Requirement: no i18n for now; keep everything in English.
  const language: 'en' = 'en';

  const { data, isLoading, error, refetch } = useTemplates({
    language,
    page,
    pageSize,
    q: search,
    category: category !== ALL_CATEGORY ? category : undefined,
    tab,
  });

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const systemUserId = useMemo(() => {
    return data?.items?.length ? getSystemUserId(data.items) : null;
  }, [data?.items]);

  const handleAddClick = () => {
    setEditingTemplate(null);
    setFormOpen(true);
  };

  const handleEdit = (template: Template) => {
    // Only allow editing user templates (not system templates)
    if (systemUserId !== null && template.ownerId === systemUserId) return;
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handlePreview = (template: Template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  const handleDuplicate = (template: Template) => {
    // Prefill form with system template data for duplication
    setEditingTemplate({
      ...template,
      name: `${template.name} (Copy)`,
      // ownerId should be set by backend on create, not by UI
      ownerId: undefined as any,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = (formData: z.infer<typeof templateSchema>) => {
    const isEditingUserTemplate =
      Boolean(editingTemplate?.id) &&
      (systemUserId === null || editingTemplate!.ownerId !== systemUserId);

    if (isEditingUserTemplate && editingTemplate?.id) {
      updateMutation.mutate(
        { id: editingTemplate.id, data: formData },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingTemplate(null);
            refetch();
          },
        },
      );
      return;
    }

    createMutation.mutate(
      { ...formData, language },
      {
        onSuccess: () => {
          setFormOpen(false);
          setEditingTemplate(null);
          setTab('my');
          refetch();
        },
      },
    );
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTemplate(null);
  };

  const handleTabChange = (newTab: 'system' | 'my') => {
    setTab(newTab);
    setPage(1);
  };

  const handleCategoryChange = (newCategory: string) => {
    // ✅ Normalize empty value (or any falsy) to ALL_CATEGORY
    setCategory(newCategory && newCategory.trim() ? newCategory : ALL_CATEGORY);
    setPage(1);
  };

  const hasItems = (data?.items?.length || 0) > 0;
  const isFiltered = Boolean(search) || category !== ALL_CATEGORY;
  const total = data?.total || 0;

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Templates"
          description="Browse system templates, copy text for campaigns, and manage your own message library."
        />

        {/* Toolbar */}
        <TemplatesToolbar
          search={search}
          onSearchChange={setSearch}
          language={language}
          onLanguageChange={() => {
            /* i18n disabled by requirement */
          }}
          // ✅ Pass non-empty category value always
          category={category}
          onCategoryChange={handleCategoryChange}
          tab={tab}
          onTabChange={handleTabChange}
          onAddClick={handleAddClick}
        />

        {/* Loading */}
        {isLoading && <TemplatesSkeleton />}

        {/* Error */}
        {error && (
          <RetailCard variant="danger">
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="text-sm font-semibold text-red-500">Couldn&apos;t load templates</div>
              <div className="max-w-md text-sm text-text-secondary">
                Please try again. If the issue persists, confirm the templates seed has been applied to the database.
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Dev-only Debug Panel */}
        {process.env.NODE_ENV !== 'production' && data && (
          <RetailCard className="border-border bg-surface-light/60">
            <div className="grid gap-1 text-xs text-text-secondary sm:grid-cols-2">
              <div>
                <span className="font-medium text-text-primary">API BaseURL:</span>{' '}
                {process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'not set'}
              </div>
              <div>
                <span className="font-medium text-text-primary">Total:</span> {total}
              </div>
              <div>
                <span className="font-medium text-text-primary">Returned:</span> {data.items?.length || 0}
              </div>
              <div>
                <span className="font-medium text-text-primary">Tab:</span> {tab}
              </div>
              <div>
                <span className="font-medium text-text-primary">Category:</span>{' '}
                {category === ALL_CATEGORY ? 'all' : category}
              </div>
              <div>
                <span className="font-medium text-text-primary">SystemUserId:</span>{' '}
                {systemUserId ?? 'null'}
              </div>
            </div>
          </RetailCard>
        )}

        {/* Content */}
        {!isLoading && !error && data && (
          <>
            {hasItems ? (
              <>
                <TemplatesTable
                  templates={data.items}
                  systemUserId={systemUserId ?? undefined}
                  onPreview={handlePreview}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                />

                {/* Pagination */}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-text-secondary">
                    Showing <span className="font-medium text-text-primary">{(page - 1) * pageSize + 1}</span> to{' '}
                    <span className="font-medium text-text-primary">{Math.min(page * pageSize, total)}</span> of{' '}
                    <span className="font-medium text-text-primary">{total}</span> templates
                  </div>

                  <div className="flex items-center gap-2">
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
                      disabled={page * pageSize >= total}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <RetailCard>
                <EmptyState
                  icon={FileText}
                  title={
                    isFiltered
                      ? 'No templates found'
                      : tab === 'my'
                        ? 'No custom templates yet'
                        : 'No system templates available'
                  }
                  description={
                    isFiltered
                      ? 'Try adjusting search or filters.'
                      : tab === 'my'
                        ? 'Create your first template or duplicate a system template to customize.'
                        : 'System templates will appear here when seeded in the database.'
                  }
                  action={
                    !isFiltered && tab === 'my' ? (
                      <Button onClick={handleAddClick} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Template
                      </Button>
                    ) : null
                  }
                />
              </RetailCard>
            )}
          </>
        )}

        <TemplateFormModal
          open={formOpen}
          onClose={handleCloseForm}
          template={editingTemplate}
          onSubmit={handleFormSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
          systemUserId={systemUserId ?? undefined}
        />

        <TemplatePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          template={previewTemplate}
          systemUserId={systemUserId ?? undefined}
        />
      </div>
    </RetailPageLayout>
  );
}
