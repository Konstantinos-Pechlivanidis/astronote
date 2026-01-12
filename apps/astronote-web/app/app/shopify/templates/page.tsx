'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTemplates } from '@/src/features/shopify/templates/hooks/useTemplates';
import { useTemplateCategories } from '@/src/features/shopify/templates/hooks/useTemplateCategories';
import { useTrackTemplateUsage } from '@/src/features/shopify/templates/hooks/useTrackTemplateUsage';
import { useEnsureDefaults } from '@/src/features/shopify/templates/hooks/useEnsureDefaults';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/src/components/retail/EmptyState';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { FileText, Search, ChevronLeft, ChevronRight, AlertCircle, Eye, X, Star, BarChart3, Users } from 'lucide-react';
import Link from 'next/link';
import type { Template } from '@/src/lib/shopify/api/templates';
import { getTemplateName, getTemplateContent, sanitizeCategory, sanitizeTemplateId } from '@/src/lib/shopify/api/templates';

// Sentinel value for "All" filter (must be non-empty for Radix Select)
const UI_ALL = '__all__';

/**
 * Templates List Page
 * Browse public SMS templates by category, search, and use templates to create campaigns
 */
export default function TemplatesPage() {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState(UI_ALL);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [favoritesFilter, setFavoritesFilter] = useState(false);
  const pageSize = 12;

  // Load favorites from localStorage
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shopify_template_favorites');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // eShop type state (can be derived from shop settings or selected by user)
  const [eshopType] = useState<string>('generic'); // Default to generic

  // Build query params
  const queryParams = useMemo(() => {
    const params: any = {
      eshopType, // eShop type filter (required)
      page: currentPage, // Use page/pageSize (Retail-aligned)
      pageSize,
      // Also support limit/offset for backward compatibility
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };
    if (categoryFilter && categoryFilter !== UI_ALL) {
      params.category = categoryFilter;
    }
    if (debouncedSearch) {
      params.search = debouncedSearch;
    }
    // Language is forced to 'en' (English-only for Shopify)
    params.language = 'en';
    return params;
  }, [eshopType, categoryFilter, debouncedSearch, currentPage, pageSize]);

  // Fetch templates
  const {
    data: templatesData,
    isLoading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates,
  } = useTemplates(queryParams);

  // Fetch categories
  const { data: categoriesData } = useTemplateCategories();

  // Track usage mutation
  const trackUsage = useTrackTemplateUsage();
  const ensureDefaults = useEnsureDefaults();

  // Filter by favorites if enabled
  // Support both Retail-aligned "items" and Shopify "templates" field names
  // Defensive mapping: ensure all templates have valid IDs and required fields
  const templates = useMemo(() => {
    const allTemplates = templatesData?.items || templatesData?.templates || [];
    // Filter out invalid templates (missing ID or empty ID)
    const validTemplates = allTemplates.filter((t) => {
      const id = sanitizeTemplateId(t.id);
      return id !== null;
    });
    // Apply favorites filter if enabled
    if (favoritesFilter) {
      return validTemplates.filter((t) => {
        const id = sanitizeTemplateId(t.id);
        return id !== null && favorites.has(id);
      });
    }
    return validTemplates;
  }, [templatesData?.items, templatesData?.templates, favoritesFilter, favorites]);

  const pagination = templatesData?.pagination || {
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };
  // Sanitize and filter categories (ensure non-empty strings)
  const categories = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData
      .map(cat => sanitizeCategory(cat))
      .filter((cat): cat is string => cat !== null);
  }, [categoriesData]);

  // Toggle favorite
  const toggleFavorite = (templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shopify_template_favorites', JSON.stringify(Array.from(newFavorites)));
    }
  };

  // Reset to page 1 when filters change
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleUseTemplate = async (template: Template) => {
    try {
      // Track template usage
      if (template.id) {
        await trackUsage.mutateAsync(template.id);
      }
    } catch (error) {
      // Error already handled by mutation hook
      // Still navigate even if tracking fails
    }

    // Navigate to campaign create with template pre-filled
    router.push('/app/shopify/campaigns/new', {
      // Note: Next.js router.push doesn't support state, so we'll use query params or localStorage
    });

    // Store template in localStorage for campaign create page to pick up
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'shopify_template_prefill',
        JSON.stringify({
          message: getTemplateContent(template),
          name: getTemplateName(template),
        }),
      );
    }
  };

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Templates"
          description="Browse SMS templates and use them to create campaigns"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => ensureDefaults.mutate(eshopType)}
              disabled={ensureDefaults.isPending}
            >
              {ensureDefaults.isPending ? 'Ensuring...' : 'Ensure Default Templates'}
            </Button>
          }
        />

        {/* Toolbar */}
        <RetailCard className="mb-6 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_ALL}>All Categories</SelectItem>
                  {categories.map((category) => {
                    // Categories are already sanitized in useMemo
                    // Ensure value is never empty (use category as-is, already validated)
                    return (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {/* eShop Type Selector (if needed - can be derived from shop settings) */}
              {/* For now, eshopType is set via state, but can be enhanced to fetch from shop settings */}
              <Button
                variant={favoritesFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFavoritesFilter(!favoritesFilter);
                  setCurrentPage(1);
                }}
              >
                <Star className={`mr-2 h-4 w-4 ${favoritesFilter ? 'fill-current' : ''}`} />
              Favorites
              </Button>
            </div>
          </div>
        </RetailCard>

        {/* Loading State */}
        {templatesLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <RetailCard key={i} className="p-6">
                <div className="space-y-4">
                  <div className="h-6 w-32 animate-pulse rounded bg-surface-light" />
                  <div className="h-4 w-24 animate-pulse rounded bg-surface-light" />
                  <div className="h-20 w-full animate-pulse rounded bg-surface-light" />
                  <div className="h-10 w-full animate-pulse rounded bg-surface-light" />
                </div>
              </RetailCard>
            ))}
          </div>
        )}

        {/* Error State */}
        {templatesError && !templatesLoading && (
          <RetailCard variant="danger" className="p-6">
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to Load Templates</h3>
              <p className="text-sm text-text-secondary mb-4">
                {templatesError instanceof Error
                  ? templatesError.message
                  : 'An error occurred while loading templates.'}
              </p>
              <Button variant="outline" onClick={() => refetchTemplates()}>
              Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Empty State */}
        {!templatesLoading && !templatesError && templates.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No templates found"
            description={
              searchQuery || (categoryFilter !== UI_ALL && categoryFilter)
                ? 'Try adjusting your search or filter criteria.'
                : 'No templates are available at the moment.'
            }
            action={
              searchQuery || (categoryFilter !== UI_ALL && categoryFilter) ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter(UI_ALL);
                  }}
                >
                Clear Filters
                </Button>
              ) : null
            }
          />
        )}

        {/* Templates Grid */}
        {!templatesLoading && !templatesError && templates.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <RetailCard key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    {/* Category Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-accent uppercase tracking-wide">
                        {template.category || 'Uncategorized'}
                      </span>
                      {template.useCount !== undefined && template.useCount > 0 && (
                        <span className="text-xs text-text-tertiary">
                        Used {template.useCount} time{template.useCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-text-primary">{getTemplateName(template)}</h3>

                    {/* Preview */}
                    <div className="rounded-lg bg-surface-light border border-border p-4 min-h-[100px]">
                      <p className="text-sm text-text-secondary whitespace-pre-wrap line-clamp-4">
                        {getTemplateContent(template)}
                      </p>
                    </div>

                    {/* Tags */}
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {template.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded bg-surface-light text-text-tertiary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Statistics Preview */}
                    {(template.conversionRate ||
                    template.productViewsIncrease ||
                    template.clickThroughRate) && (
                      <div className="rounded-lg bg-surface-light border border-border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="h-4 w-4 text-text-tertiary" />
                          <span className="text-xs font-medium text-text-secondary">Performance</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {template.conversionRate !== null &&
                          template.conversionRate !== undefined && (
                            <div>
                              <div className="text-text-tertiary">Conv.</div>
                              <div className="font-semibold text-accent">
                                {template.conversionRate.toFixed(1)}%
                              </div>
                            </div>
                          )}
                          {template.productViewsIncrease !== null &&
                          template.productViewsIncrease !== undefined && (
                            <div>
                              <div className="text-text-tertiary">Views</div>
                              <div className="font-semibold text-green-400">
                                +{template.productViewsIncrease.toFixed(1)}%
                              </div>
                            </div>
                          )}
                          {template.clickThroughRate !== null &&
                          template.clickThroughRate !== undefined && (
                            <div>
                              <div className="text-text-tertiary">CTR</div>
                              <div className="font-semibold text-blue-400">
                                {template.clickThroughRate.toFixed(1)}%
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewTemplate(template)}
                        className="flex-1"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                      Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(template.id)}
                        className={favorites.has(template.id) ? 'text-accent' : ''}
                      >
                        <Star
                          className={`h-4 w-4 ${favorites.has(template.id) ? 'fill-current' : ''}`}
                        />
                      </Button>
                      <Button
                        onClick={() => handleUseTemplate(template)}
                        className="flex-1"
                        disabled={trackUsage.isPending}
                      >
                      Use
                      </Button>
                    </div>
                  </div>
                </RetailCard>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} templates
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrevPage || templatesLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  Previous
                  </Button>
                  <div className="text-sm text-text-secondary">
                  Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasNextPage || templatesLoading}
                  >
                  Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Preview Modal */}
        {previewTemplate && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setPreviewTemplate(null)}
              />
              <RetailCard className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-text-primary">{getTemplateName(previewTemplate)}</h2>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="text-text-tertiary hover:text-text-primary"
                    aria-label="Close preview modal"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Category */}
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-1">Category</div>
                    <StatusBadge status="default" label={previewTemplate.category || 'Uncategorized'} />
                  </div>

                  {/* Content */}
                  <div>
                    <div className="text-sm font-medium text-text-secondary mb-2">Message Content</div>
                    <div className="rounded-lg bg-surface-light border border-border p-4">
                      <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                        {getTemplateContent(previewTemplate)}
                      </p>
                    </div>
                  </div>

                  {/* Statistics */}
                  {(previewTemplate.conversionRate ||
                  previewTemplate.productViewsIncrease ||
                  previewTemplate.clickThroughRate ||
                  previewTemplate.averageOrderValue ||
                  previewTemplate.customerRetention) && (
                    <div>
                      <div className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                      Performance Statistics
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {previewTemplate.conversionRate !== null &&
                        previewTemplate.conversionRate !== undefined && (
                          <div className="p-3 rounded-lg bg-surface-light border border-border">
                            <div className="text-xs text-text-tertiary mb-1">Conversion Rate</div>
                            <div className="text-lg font-bold text-accent">
                              {previewTemplate.conversionRate.toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {previewTemplate.productViewsIncrease !== null &&
                        previewTemplate.productViewsIncrease !== undefined && (
                          <div className="p-3 rounded-lg bg-surface-light border border-border">
                            <div className="text-xs text-text-tertiary mb-1">Product Views</div>
                            <div className="text-lg font-bold text-green-400">
                              +{previewTemplate.productViewsIncrease.toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {previewTemplate.clickThroughRate !== null &&
                        previewTemplate.clickThroughRate !== undefined && (
                          <div className="p-3 rounded-lg bg-surface-light border border-border">
                            <div className="text-xs text-text-tertiary mb-1">Click-Through Rate</div>
                            <div className="text-lg font-bold text-blue-400">
                              {previewTemplate.clickThroughRate.toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {previewTemplate.averageOrderValue !== null &&
                        previewTemplate.averageOrderValue !== undefined && (
                          <div className="p-3 rounded-lg bg-surface-light border border-border">
                            <div className="text-xs text-text-tertiary mb-1">Avg Order Value</div>
                            <div className="text-lg font-bold text-purple-400">
                              +{previewTemplate.averageOrderValue.toFixed(1)}%
                            </div>
                          </div>
                        )}
                        {previewTemplate.customerRetention !== null &&
                        previewTemplate.customerRetention !== undefined && (
                          <div className="p-3 rounded-lg bg-surface-light border border-border col-span-2">
                            <div className="text-xs text-text-tertiary mb-1">Customer Retention</div>
                            <div className="text-lg font-bold text-accent">
                              +{previewTemplate.customerRetention.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {previewTemplate.tags && previewTemplate.tags.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-text-secondary mb-2">Tags</div>
                      <div className="flex flex-wrap gap-2">
                        {previewTemplate.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded bg-surface-light text-text-tertiary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Use Count */}
                  {previewTemplate.useCount !== undefined && previewTemplate.useCount > 0 && (
                    <div>
                      <div className="text-sm font-medium text-text-secondary mb-1">Times Used</div>
                      <div className="text-text-primary flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {previewTemplate.useCount} time{previewTemplate.useCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(previewTemplate.id)}
                      className={favorites.has(previewTemplate.id) ? 'text-accent' : ''}
                    >
                      <Star
                        className={`mr-2 h-4 w-4 ${favorites.has(previewTemplate.id) ? 'fill-current' : ''}`}
                      />
                      {favorites.has(previewTemplate.id) ? 'Unfavorite' : 'Favorite'}
                    </Button>
                    <Link
                      href={`/app/shopify/templates/${previewTemplate.id}`}
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full">
                      View Details
                      </Button>
                    </Link>
                    <Button
                      onClick={() => {
                        setPreviewTemplate(null);
                        handleUseTemplate(previewTemplate);
                      }}
                      className="flex-1"
                      disabled={trackUsage.isPending}
                    >
                    Use Template
                    </Button>
                  </div>
                </div>
              </RetailCard>
            </div>
          </div>
        )}
      </div>
    </RetailPageLayout>
  );
}
