'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Plus } from 'lucide-react';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailDataTable } from '@/src/components/retail/RetailDataTable';
import { Dialog } from '@/src/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEvents } from '@/src/features/retail/events/hooks/useEvents';
import { useCreateEvent } from '@/src/features/retail/events/hooks/useCreateEvent';
import { useUpdateEventStatus } from '@/src/features/retail/events/hooks/useUpdateEventStatus';
import type { CustomerEvent, CustomerEventStatus, CustomerEventType } from '@/src/lib/retail/api/events';

const EVENT_TYPE_OPTIONS: { value: CustomerEventType; label: string }[] = [
  { value: 'appointment', label: 'Appointment' },
  { value: 'membership', label: 'Membership' },
  { value: 'stay', label: 'Stay' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'visit', label: 'Visit' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS: { value: CustomerEventStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'no_show', label: 'No-show' },
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function getContactLabel(event: CustomerEvent) {
  if (event.contact) {
    const name = [event.contact.firstName, event.contact.lastName].filter(Boolean).join(' ').trim();
    return name || event.contact.phone;
  }
  return event.phoneE164 || '—';
}

export default function EventsPage() {
  const [filters, setFilters] = useState({
    type: '' as CustomerEventType | '',
    status: '' as CustomerEventStatus | '',
    phone: '',
    from: '',
    to: '',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState({
    eventType: 'appointment' as CustomerEventType,
    status: 'scheduled' as CustomerEventStatus,
    phone: '',
    startAt: '',
    endAt: '',
    externalRef: '',
    meta: '',
  });
  const [metaError, setMetaError] = useState<string | null>(null);

  const params = useMemo(() => ({
    type: filters.type || undefined,
    status: filters.status || undefined,
    phone: filters.phone || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  }), [filters]);

  const { data, isLoading, error, refetch } = useEvents(params);
  const createEvent = useCreateEvent();
  const updateStatus = useUpdateEventStatus();

  const handleCreate = () => {
    setMetaError(null);
    let metaPayload: Record<string, any> | null = null;
    if (formState.meta?.trim()) {
      try {
        metaPayload = JSON.parse(formState.meta);
      } catch (err) {
        setMetaError('Meta must be valid JSON');
        return;
      }
    }

    createEvent.mutate(
      {
        eventType: formState.eventType,
        status: formState.status,
        phone: formState.phone || null,
        startAt: formState.startAt ? new Date(formState.startAt).toISOString() : null,
        endAt: formState.endAt ? new Date(formState.endAt).toISOString() : null,
        externalRef: formState.externalRef || null,
        meta: metaPayload || null,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setFormState({
            eventType: 'appointment',
            status: 'scheduled',
            phone: '',
            startAt: '',
            endAt: '',
            externalRef: '',
            meta: '',
          });
        },
      },
    );
  };

  const columns = [
    {
      key: 'eventType',
      header: 'Type',
      render: (event: CustomerEvent) => (
        <span className="text-sm font-medium text-text-primary capitalize">
          {event.eventType.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (event: CustomerEvent) => {
        const isUpdating = updateStatus.isPending && updateStatus.variables?.id === event.id;
        return (
          <Select
            value={event.status}
            onValueChange={(value) => {
              updateStatus.mutate({ id: event.id, payload: { status: value as CustomerEventStatus } });
            }}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 w-[150px]">
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
        );
      },
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (event: CustomerEvent) => (
        <div className="text-sm text-text-secondary">
          {getContactLabel(event)}
        </div>
      ),
    },
    {
      key: 'startAt',
      header: 'Start',
      render: (event: CustomerEvent) => (
        <span className="text-sm text-text-secondary">{formatDateTime(event.startAt)}</span>
      ),
    },
    {
      key: 'endAt',
      header: 'End',
      render: (event: CustomerEvent) => (
        <span className="text-sm text-text-secondary">{formatDateTime(event.endAt)}</span>
      ),
    },
  ];

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader
          title="Events"
          description="Track customer appointments, visits, purchases, and more."
          actions={(
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          )}
        />

        <RetailCard>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-xs font-medium text-text-tertiary">Type</label>
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value as CustomerEventType }))}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-tertiary">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as CustomerEventStatus }))}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((option) => (
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
                value={filters.phone}
                onChange={(e) => setFilters((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+3069..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-tertiary">From</label>
              <Input
                className="mt-1 h-9"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-text-tertiary">To</label>
              <Input
                className="mt-1 h-9"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </RetailCard>

        {isLoading ? (
          <RetailCard>
            <div className="py-10 text-center text-sm text-text-secondary">Loading events...</div>
          </RetailCard>
        ) : (
          <RetailDataTable
            columns={columns}
            data={data?.items || []}
            keyExtractor={(item) => item.id}
            emptyTitle="No events yet"
            emptyDescription="Add an event to start triggering automation presets."
            emptyIcon={CalendarDays}
            error={error ? 'Unable to load events' : undefined}
            onRetry={refetch}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Event" size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-text-secondary">Event Type</label>
              <Select
                value={formState.eventType}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, eventType: value as CustomerEventType }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">Status</label>
              <Select
                value={formState.status}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, status: value as CustomerEventStatus }))}
              >
                <SelectTrigger className="mt-1">
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
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary">Contact phone (E.164)</label>
            <Input
              className="mt-1"
              value={formState.phone}
              onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+306912345678"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-text-secondary">Start</label>
              <Input
                className="mt-1"
                type="datetime-local"
                value={formState.startAt}
                onChange={(e) => setFormState((prev) => ({ ...prev, startAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary">End</label>
              <Input
                className="mt-1"
                type="datetime-local"
                value={formState.endAt}
                onChange={(e) => setFormState((prev) => ({ ...prev, endAt: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary">External Reference (optional)</label>
            <Input
              className="mt-1"
              value={formState.externalRef}
              onChange={(e) => setFormState((prev) => ({ ...prev, externalRef: e.target.value }))}
              placeholder="booking-123"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary">Meta JSON (optional)</label>
            <Textarea
              className="mt-1"
              value={formState.meta}
              onChange={(e) => setFormState((prev) => ({ ...prev, meta: e.target.value }))}
              rows={4}
              placeholder='{"serviceName":"Haircut","staff":"Maria"}'
            />
            {metaError && <p className="mt-1 text-xs text-red-400">{metaError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Saving...' : 'Create Event'}
            </Button>
          </div>
        </div>
      </Dialog>
    </RetailPageLayout>
  );
}
