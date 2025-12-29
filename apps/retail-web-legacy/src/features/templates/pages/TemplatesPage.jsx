import { useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import EmptyState from '../../../components/common/EmptyState';
import ErrorState from '../../../components/common/ErrorState';
import TemplatesToolbar from '../components/TemplatesToolbar';
import TemplatesTable from '../components/TemplatesTable';
import TemplateFormModal from '../components/TemplateFormModal';
import TemplatePreviewModal from '../components/TemplatePreviewModal';
import TemplatesSkeleton from '../components/TemplatesSkeleton';
import { useTemplates } from '../hooks/useTemplates';
import { useCreateTemplate } from '../hooks/useCreateTemplate';
import { useUpdateTemplate } from '../hooks/useUpdateTemplate';
import { useDeleteTemplate } from '../hooks/useDeleteTemplate';
import { FileText, Plus } from 'lucide-react';

// System User ID (default: 1, should ideally come from backend/config)
const SYSTEM_USER_ID = 1;

export default function TemplatesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('');
  const [tab, setTab] = useState('system'); // 'system' | 'my'
  const [formOpen, setFormOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

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

  const handleEdit = (template) => {
    // Only allow editing user templates
    if (template.ownerId === SYSTEM_USER_ID) {
      return; // System templates cannot be edited
    }
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const handleDuplicate = (template) => {
    // Prefill form with system template data for duplication
    setEditingTemplate({
      ...template,
      name: `${template.name} (Copy)`,
      ownerId: null, // Will be set to user.id on create
    });
    setFormOpen(true);
  };

  const handleFormSubmit = (data) => {
    if (editingTemplate && editingTemplate.id && editingTemplate.ownerId !== SYSTEM_USER_ID) {
      // Update existing user template
      updateMutation.mutate(
        { id: editingTemplate.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingTemplate(null);
          },
        }
      );
    } else {
      // Create new template (from scratch or duplicate)
      createMutation.mutate(
        {
          ...data,
          language: language, // Use current language selection
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            setEditingTemplate(null);
            // Switch to "My Templates" tab to show the new template
            setTab('my');
          },
        }
      );
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTemplate(null);
  };

  // Reset to page 1 when filters change
  const handleTabChange = (newTab) => {
    setTab(newTab);
    setPage(1);
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    setPage(1);
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Browse system templates and manage your custom message templates"
      />

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
        systemUserId={SYSTEM_USER_ID}
      />

      {isLoading && <TemplatesSkeleton />}

      {error && <ErrorState error={error} onRetry={refetch} />}

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
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of{' '}
                  {data.total} templates
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * pageSize >= data.total}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
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
                    <button
                      onClick={handleAddClick}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Template
                    </button>
                  )
                }
              />
            </div>
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

