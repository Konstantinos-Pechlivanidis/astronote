'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTemplate } from '@/src/features/shopify/templates/hooks/useTemplate';
import { useTrackTemplateUsage } from '@/src/features/shopify/templates/hooks/useTrackTemplateUsage';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { ArrowLeft, FileText, BarChart3, Users } from 'lucide-react';
import { format } from 'date-fns';
import { getTemplateName, getTemplateContent } from '@/src/lib/shopify/api/templates';

/**
 * Template Detail Page
 */
export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: template, isLoading, error } = useTemplate(id);
  const trackUsage = useTrackTemplateUsage();

  const handleUseTemplate = async () => {
    if (!template) return;

    try {
      // Track template usage
      await trackUsage.mutateAsync(template.id);
    } catch (error) {
      // Error already handled by mutation hook
      // Still navigate even if tracking fails
    }

    // Navigate to campaign create with template pre-filled
    router.push('/app/shopify/campaigns/new');

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

  // Loading state
  if (isLoading) {
    return (
      <div>
        <RetailPageHeader title="Template Details" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <RetailCard key={i} className="p-6">
              <div className="space-y-4">
                <div className="h-6 w-32 animate-pulse rounded bg-surface-light" />
                <div className="h-8 w-24 animate-pulse rounded bg-surface-light" />
              </div>
            </RetailCard>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !template) {
    return (
      <div>
        <RetailPageHeader title="Template Details" />
        <RetailCard variant="danger" className="p-6">
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Template Not Found</h3>
            <p className="text-sm text-text-secondary mb-4">
              {error instanceof Error
                ? error.message
                : 'The template you are looking for does not exist.'}
            </p>
            <Link href="/app/shopify/templates">
              <Button variant="outline">Back to Templates</Button>
            </Link>
          </div>
        </RetailCard>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title={getTemplateName(template)}
            description={`Template: ${template.category || 'Uncategorized'}`}
          />
        </div>
        <Button onClick={handleUseTemplate} disabled={trackUsage.isPending}>
          Use Template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Content */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Message Content
            </h3>
            <div className="rounded-lg bg-surface-light border border-border p-6">
              <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                {getTemplateContent(template)}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <StatusBadge
                status="default"
                label={template.category || 'Uncategorized'}
              />
              {template.tags && template.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 rounded bg-surface-light text-text-tertiary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </RetailCard>

          {/* Statistics */}
          {(template.conversionRate ||
            template.productViewsIncrease ||
            template.clickThroughRate ||
            template.averageOrderValue ||
            template.customerRetention) && (
            <RetailCard className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Statistics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {template.conversionRate !== null && template.conversionRate !== undefined && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <div className="text-sm font-medium text-text-secondary mb-1">Conversion Rate</div>
                    <div className="text-2xl font-bold text-accent">
                      {template.conversionRate.toFixed(1)}%
                    </div>
                  </div>
                )}
                {template.productViewsIncrease !== null &&
                  template.productViewsIncrease !== undefined && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <div className="text-sm font-medium text-text-secondary mb-1">Product Views</div>
                    <div className="text-2xl font-bold text-green-400">
                        +{template.productViewsIncrease.toFixed(1)}%
                    </div>
                  </div>
                )}
                {template.clickThroughRate !== null && template.clickThroughRate !== undefined && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <div className="text-sm font-medium text-text-secondary mb-1">Click-Through Rate</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {template.clickThroughRate.toFixed(1)}%
                    </div>
                  </div>
                )}
                {template.averageOrderValue !== null && template.averageOrderValue !== undefined && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border">
                    <div className="text-sm font-medium text-text-secondary mb-1">Avg Order Value</div>
                    <div className="text-2xl font-bold text-purple-400">
                      +{template.averageOrderValue.toFixed(1)}%
                    </div>
                  </div>
                )}
                {template.customerRetention !== null && template.customerRetention !== undefined && (
                  <div className="p-4 rounded-lg bg-surface-light border border-border col-span-2">
                    <div className="text-sm font-medium text-text-secondary mb-1">Customer Retention</div>
                    <div className="text-2xl font-bold text-accent">
                      +{template.customerRetention.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </RetailCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Template Info */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Template Information</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-text-secondary mb-1">Category</div>
                <div className="text-text-primary">{template.category || 'Uncategorized'}</div>
              </div>
              {template.useCount !== undefined && template.useCount > 0 && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Times Used</div>
                  <div className="text-text-primary flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {template.useCount} time{template.useCount !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
              {template.createdAt && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Created</div>
                  <div className="text-text-primary">
                    {format(new Date(template.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              )}
              {template.updatedAt && (
                <div>
                  <div className="text-sm font-medium text-text-secondary mb-1">Last Updated</div>
                  <div className="text-text-primary">
                    {format(new Date(template.updatedAt), 'MMM d, yyyy')}
                  </div>
                </div>
              )}
            </div>
          </RetailCard>

          {/* Actions */}
          <RetailCard className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Actions</h3>
            <div className="space-y-2">
              <Button onClick={handleUseTemplate} disabled={trackUsage.isPending} className="w-full">
                Use Template
              </Button>
              <Link href="/app/shopify/templates">
                <Button variant="outline" className="w-full">
                  Back to Templates
                </Button>
              </Link>
            </div>
          </RetailCard>
        </div>
      </div>
    </div>
  );
}

