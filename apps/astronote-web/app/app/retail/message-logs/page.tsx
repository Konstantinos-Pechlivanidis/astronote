'use client';

import { useMemo, useState } from 'react';
import { Download, ListChecks } from 'lucide-react';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailDataTable } from '@/src/components/retail/RetailDataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMessageLogs } from '@/src/features/retail/message-logs/hooks/useMessageLogs';
import { messageLogsApi, type MessageLogItem, type MessageLogSource, type MessageLogStatus, type MessageLogType } from '@/src/lib/retail/api/messageLogs';
import { toast } from 'sonner';

const STATUS_OPTIONS: { value: MessageLogStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'pending', label: 'Pending' },
];

const SOURCE_OPTIONS: { value: MessageLogSource | ''; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'campaign', label: 'Campaigns' },
  { value: 'automation', label: 'Automations' },
  { value: 'automation_library', label: 'Automation Library' },
  { value: 'direct', label: 'Direct' },
];

const TYPE_OPTIONS: { value: MessageLogType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'service', label: 'Service' },
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatStatus(value?: string | null) {
  if (!value) return '—';
  return value.replace('_', ' ');
}

export default function MessageLogsPage() {
  const [filters, setFilters] = useState({
    status: '' as MessageLogStatus | '',
    source: '' as MessageLogSource | '',
    messageType: '' as MessageLogType | '',
    phone: '',
    from: '',
    to: '',
  });
  const [isExporting, setIsExporting] = useState(false);

  const params = useMemo(() => ({
    page: 1,
    pageSize: 50,
    status: filters.status || undefined,
    source: filters.source || undefined,
    messageType: filters.messageType || undefined,
    phone: filters.phone || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }), [filters]);

  const { data, isLoading, error, refetch } = useMessageLogs(params);

  const handleExport = async () => {
    if (!filters.from || !filters.to) {
      toast.error('Select a date range to export.');
      return;
    }
    setIsExporting(true);
    try {
      const res = await messageLogsApi.exportCsv({ from: filters.from, to: filters.to });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `message_logs_${filters.from}_${filters.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export ready');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (item: MessageLogItem) => (
        <span className="text-sm text-text-secondary">{formatDateTime(item.createdAt)}</span>
      ),
    },
    {
      key: 'sourceName',
      header: 'Source',
      render: (item: MessageLogItem) => (
        <div className="text-sm text-text-primary">{item.sourceName}</div>
      ),
    },
    {
      key: 'messageType',
      header: 'Type',
      render: (item: MessageLogItem) => (
        <span className="text-sm capitalize text-text-secondary">{formatStatus(item.messageType)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: MessageLogItem) => (
        <span className="text-sm capitalize text-text-primary">{formatStatus(item.status)}</span>
      ),
    },
    {
      key: 'deliveryStatus',
      header: 'Delivery',
      render: (item: MessageLogItem) => (
        <span className="text-sm text-text-secondary">{formatStatus(item.deliveryStatus)}</span>
      ),
    },
    {
      key: 'phoneE164',
      header: 'Phone',
      render: (item: MessageLogItem) => (
        <span className="text-sm text-text-primary">{item.phoneE164 || '—'}</span>
      ),
    },
    {
      key: 'creditsCharged',
      header: 'Credits',
      render: (item: MessageLogItem) => (
        <span className="text-sm text-text-secondary">{item.creditsCharged ?? 0}</span>
      ),
    },
    {
      key: 'transactionId',
      header: 'Txn',
      render: (item: MessageLogItem) => (
        <span className="text-xs text-text-tertiary">{item.transactionId ?? '—'}</span>
      ),
    },
  ];

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Message logs"
          description="Track sent messages, delivery status, and credits usage."
          actions={(
            <Button size="sm" variant="outline" onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}
        />

        <RetailCard>
          <div className="grid gap-4 md:grid-cols-6">
            <div>
              <label className="text-xs font-medium text-text-tertiary">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as MessageLogStatus | '' }))}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary">Source</label>
              <Select
                value={filters.source}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, source: value as MessageLogSource | '' }))}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary">Type</label>
              <Select
                value={filters.messageType}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, messageType: value as MessageLogType | '' }))}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary">Phone</label>
              <Input
                className="mt-1 h-9"
                placeholder="+3069..."
                value={filters.phone}
                onChange={(event) => setFilters((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary">From</label>
              <Input
                className="mt-1 h-9"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-tertiary">To</label>
              <Input
                className="mt-1 h-9"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
          </div>
        </RetailCard>

        <RetailDataTable
          columns={columns}
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          emptyTitle="No message activity"
          emptyDescription="Messages will appear here once sends occur."
          emptyIcon={ListChecks}
          error={error ? 'Failed to load message logs' : undefined}
          onRetry={refetch}
          className={isLoading ? 'opacity-60' : undefined}
        />
      </div>
    </RetailPageLayout>
  );
}
