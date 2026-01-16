'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAutomations } from '@/src/features/shopify/automations/hooks/useAutomations';
import { useAutomationStats } from '@/src/features/shopify/automations/hooks/useAutomationStats';
import {
  useUpdateAutomation,
  useDeleteAutomation,
} from '@/src/features/shopify/automations/hooks/useAutomationMutations';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { StatusBadge } from '@/src/components/retail/StatusBadge';
import { Pagination } from '@/src/components/app/Pagination';
import { getIntParam, setQueryParams } from '@/src/lib/url/query';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { EmptyState } from '@/src/components/retail/EmptyState';
import {
  Zap,
  Play,
  Pause,
  Trash2,
  Edit,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import type {
  Automation,
  AutomationStatus,
} from '@/src/lib/shopify/api/automations';

// Sentinel value for "All" filter (must be non-empty for Radix Select)
const UI_ALL = '__all__';

/**
 * Automations List Page
 */
export default function AutomationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | typeof UI_ALL>(UI_ALL);
  const [currentPage, setCurrentPage] = useState(getIntParam(searchParams.get('page'), 1));
  const [pageSize, setPageSize] = useState(getIntParam(searchParams.get('pageSize'), 9));
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const updateUrl = (updates: Record<string, string | number | null | undefined>) => {
    router.replace(setQueryParams(searchParams, updates), { scroll: false });
  };

  // Fetch automations
  const {
    data: automations,
    isLoading: automationsLoading,
    error: automationsError,
    refetch: refetchAutomations,
  } = useAutomations();

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useAutomationStats();

  // Mutations
  const updateAutomation = useUpdateAutomation();
  const deleteAutomation = useDeleteAutomation();

  // Filter automations by status
  const filteredAutomations = useMemo(() => {
    if (!automations) return [];
    if (statusFilter === UI_ALL) return automations;
    return automations.filter(a => a.status === statusFilter);
  }, [automations, statusFilter]);

  const pagination = useMemo(() => {
    const total = filteredAutomations.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, currentPage), totalPages);
    return {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }, [filteredAutomations.length, pageSize, currentPage]);

  const pagedAutomations = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredAutomations.slice(start, end);
  }, [filteredAutomations, pagination.page, pagination.pageSize]);

  // Check if automation is "coming soon"
  const isComingSoon = (automation: Automation) => {
    const comingSoonTriggers = [
      'cart_abandoned',
      'customer_inactive',
      'abandoned_cart',
    ];
    return comingSoonTriggers.includes(automation.trigger);
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: AutomationStatus,
  ) => {
    try {
      const newStatus: AutomationStatus =
        currentStatus === 'active' ? 'paused' : 'active';
      await updateAutomation.mutateAsync({
        id,
        data: { status: newStatus },
      });
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAutomation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  // Stats cards
  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: 'Total',
        value: stats.total || 0,
        icon: Zap,
        variant: 'default' as const,
      },
      {
        label: 'Active',
        value: stats.active || 0,
        icon: Play,
        variant: 'default' as const,
      },
      {
        label: 'Paused',
        value: stats.paused || 0,
        icon: Pause,
        variant: 'default' as const,
      },
      {
        label: 'Messages Sent',
        value: stats.messagesSent || 0,
        icon: MessageSquare,
        variant: 'default' as const,
      },
    ];
  }, [stats]);

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Automations"
          description="Set up automated SMS workflows for your store"
          actions={
            <Link href="/app/shopify/automations/new">
              <Button size="sm">
                <Zap className="mr-2 h-4 w-4" />
                Create Automation
              </Button>
            </Link>
          }
        />

        {/* Automations Guide */}
        <RetailCard className="p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Automations Guide</h2>
            <p className="text-sm text-text-secondary">
              Each automation sends an SMS when a Shopify event happens. Make sure contacts have a phone number and SMS consent.
            </p>
            <p className="text-sm text-text-secondary">
              Unsubscribe text is appended automatically during sending. Keep messages short for fewer SMS segments.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              {
                title: 'Welcome',
                when: 'When a customer opts in / is created (depending on store setup).',
                setup: 'Write a friendly intro and include a benefit (discount, store info, etc.).',
                vars: ['{{firstName}}', '{{lastName}}', '{{discountCode}}'],
              },
              {
                title: 'Order placed',
                when: 'After an order is created in Shopify.',
                setup: 'Confirm order and set expectations (shipping timeline).',
                vars: ['{{firstName}}', '{{lastName}}'],
              },
              {
                title: 'Order fulfilled',
                when: 'When Shopify marks an order as fulfilled.',
                setup: 'Share shipment or delivery expectations; keep it short.',
                vars: ['{{firstName}}', '{{lastName}}'],
              },
              {
                title: 'Review request',
                when: 'A few days after delivery (if enabled in your store configuration).',
                setup: 'Ask for a quick review and thank them.',
                vars: ['{{firstName}}', '{{lastName}}'],
              },
            ].map((item) => (
              <details key={item.title} className="group rounded-2xl border border-border bg-surface-light px-4 py-3">
                <summary className="cursor-pointer list-none select-none">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                      <div className="mt-0.5 text-xs text-text-tertiary">{item.when}</div>
                    </div>
                    <span className="text-xs text-text-tertiary group-open:hidden">Show</span>
                    <span className="text-xs text-text-tertiary hidden group-open:inline">Hide</span>
                  </div>
                </summary>

                <div className="mt-3 space-y-3 text-sm text-text-secondary">
                  <div>
                    <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">Setup</div>
                    <div className="mt-1">{item.setup}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-text-secondary uppercase tracking-wide">Variables</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.vars.map((v) => (
                        <code key={v} className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-text-primary">
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    Troubleshooting: if nothing sends, check consent, phone number, and whether the trigger event happened in Shopify.
                  </div>
                </div>
              </details>
            ))}
          </div>
        </RetailCard>

        {/* Stats Cards */}
        {!statsLoading && stats && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <RetailCard key={idx} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-text-secondary mb-1">
                        {card.label}
                      </div>
                      <div className="text-2xl font-bold text-text-primary">
                        {card.value.toLocaleString()}
                      </div>
                    </div>
                    <Icon className="h-8 w-8 text-text-tertiary" />
                  </div>
                </RetailCard>
              );
            })}
          </div>
        )}

        {/* Filter Toolbar */}
        <RetailCard className="mb-6 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Select
                value={statusFilter}
                onValueChange={value =>
                  (() => {
                    setStatusFilter(value as AutomationStatus | typeof UI_ALL);
                    setCurrentPage(1);
                    updateUrl({ page: 1 });
                  })()
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UI_ALL}>All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </RetailCard>

        {/* Loading State */}
        {automationsLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
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
        {automationsError && !automationsLoading && (
          <RetailCard variant="danger" className="p-6">
            <div className="text-center py-8">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Failed to Load Automations
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                {automationsError instanceof Error
                  ? automationsError.message
                  : 'An error occurred while loading automations.'}
              </p>
              <Button variant="outline" onClick={() => refetchAutomations()}>
                Retry
              </Button>
            </div>
          </RetailCard>
        )}

        {/* Empty State */}
        {!automationsLoading &&
          !automationsError &&
          filteredAutomations.length === 0 && (
          <EmptyState
            icon={Zap}
            title="No automations found"
            description={
              statusFilter
                ? 'Try adjusting your filter criteria.'
                : 'Create your first automation to get started with automated SMS workflows.'
            }
            action={
              statusFilter === UI_ALL ? (
                <Link href="/app/shopify/automations/new">
                  <Button>
                    <Zap className="mr-2 h-4 w-4" />
                      Create Automation
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" onClick={() => setStatusFilter(UI_ALL)}>
                    Clear Filter
                </Button>
              )
            }
          />
        )}

        {/* Automations Grid */}
        {!automationsLoading &&
          !automationsError &&
          filteredAutomations.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pagedAutomations.map(automation => {
              const comingSoon = isComingSoon(automation);
              return (
                <RetailCard
                  key={automation.id}
                  className="p-6 hover:shadow-lg transition-shadow relative"
                >
                  {comingSoon && (
                    <div className="absolute top-4 right-4 z-10">
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                          Coming Soon
                      </span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between pr-20">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2">
                          {automation.name}
                        </h3>
                        <StatusBadge
                          status={
                            automation.status === 'active'
                              ? 'success'
                              : automation.status === 'paused'
                                ? 'warning'
                                : 'default'
                          }
                          label={automation.status}
                        />
                      </div>
                    </div>

                    {/* Trigger */}
                    {automation.trigger && (
                      <div>
                        <div className="text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                            Trigger
                        </div>
                        <div className="text-sm text-text-primary capitalize">
                          {automation.trigger.replace(/_/g, ' ')}
                        </div>
                      </div>
                    )}

                    {/* Message Preview */}
                    {automation.message && (
                      <div>
                        <div className="text-xs font-medium text-text-secondary mb-1 uppercase tracking-wide">
                            Message
                        </div>
                        <div className="rounded-lg bg-surface-light border border-border p-3">
                          <p className="text-sm text-text-primary line-clamp-3 whitespace-pre-wrap">
                            {automation.message}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                      <Link
                        href={`/app/shopify/automations/${automation.id}`}
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={comingSoon}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleToggleStatus(automation.id, automation.status)
                        }
                        disabled={comingSoon || updateAutomation.isPending}
                        className="flex-1"
                      >
                        {automation.status === 'active' ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                              Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                              Activate
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            id: automation.id,
                            name: automation.name,
                          })
                        }
                        disabled={comingSoon || deleteAutomation.isPending}
                        className="text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </RetailCard>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!automationsLoading && !automationsError && filteredAutomations.length > 0 && (
          <RetailCard className="p-4">
            <Pagination
              pagination={pagination}
              onPageChange={(p) => {
                setCurrentPage(p);
                updateUrl({ page: p });
              }}
              onPageSizeChange={(ps) => {
                setPageSize(ps);
                setCurrentPage(1);
                updateUrl({ pageSize: ps, page: 1 });
              }}
              pageSizeOptions={[9, 18, 36]}
              disabled={automationsLoading}
            />
          </RetailCard>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Automation"
          message={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </RetailPageLayout>
  );
}
