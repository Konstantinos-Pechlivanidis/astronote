'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog } from '@/src/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { SubscriptionBadge } from './SubscriptionBadge';
import { useBillingGate } from '@/src/features/retail/billing/hooks/useBillingGate';
import { directMessagesApi, type DirectMessage } from '@/src/lib/retail/api/directMessages';
import type { Contact } from '@/src/lib/retail/api/contacts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DirectMessageModalProps {
  open: boolean
  onClose: () => void
  contact: Contact | null
}

function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `direct-${crypto.randomUUID()}`;
  }
  return `direct-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DirectMessageModal({ open, onClose, contact }: DirectMessageModalProps) {
  const [messageBody, setMessageBody] = useState('');
  const [lastMessage, setLastMessage] = useState<DirectMessage | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'marketing' | 'service'>('marketing');
  const { credits, subscription, reason, isLoading } = useBillingGate();

  useEffect(() => {
    if (open) {
      setMessageBody('');
      setLastMessage(null);
      setIdempotencyKey(generateIdempotencyKey());
      setMessageType('marketing');
    }
  }, [open, contact?.id]);

  const isSubscribed = contact?.isSubscribed !== false;
  const isServiceAllowed = contact?.serviceAllowed !== false;
  const blockedReason = useMemo(() => {
    if (!subscription?.active) {
      return reason || 'Active subscription required to send SMS.';
    }
    if (messageType === 'marketing' && !isSubscribed) {
      return 'This contact is unsubscribed. Marketing messages are blocked.';
    }
    if (messageType === 'service' && !isServiceAllowed) {
      return 'This contact has not allowed service messages.';
    }
    if (!isLoading && (credits ?? 0) < 1) {
      return 'Not enough credits to send this message.';
    }
    return null;
  }, [subscription?.active, reason, isSubscribed, isServiceAllowed, isLoading, credits, messageType]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!contact?.id) {
        throw new Error('Contact is required');
      }
      return directMessagesApi.send(
        {
          contactId: contact.id,
          messageBody,
          messageType,
        },
        idempotencyKey || undefined,
      );
    },
    onSuccess: (res) => {
      setLastMessage(res.data);
      toast.success('Message sent');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send message';
      toast.error(message);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!lastMessage?.id) {
        throw new Error('No message to refresh');
      }
      return directMessagesApi.refresh(lastMessage.id);
    },
    onSuccess: (res) => {
      setLastMessage(res.data.message);
      toast.success('Status updated');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to refresh status';
      toast.error(message);
    },
  });

  const statusLabel = useMemo(() => {
    if (!lastMessage) return null;
    const delivery = (lastMessage.deliveryStatus || '').toLowerCase();
    if (delivery.includes('deliv')) {
      return 'Delivered';
    }
    if (lastMessage.status === 'failed' || delivery.includes('fail')) {
      return 'Failed';
    }
    return 'Sent (Pending delivery)';
  }, [lastMessage]);

  if (!contact) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} title="Send SMS" size="md">
      <div className="space-y-4">
        <RetailCard className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-text-primary">
                {contact.firstName || contact.lastName
                  ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                  : 'Contact'}
              </div>
              <div className="text-xs text-text-secondary">{contact.phone}</div>
            </div>
            <SubscriptionBadge isSubscribed={isSubscribed} />
          </div>
          <div className="mt-3 text-xs text-text-secondary">
            Remaining credits: {isLoading ? '…' : credits ?? 0}
          </div>
        </RetailCard>

        {blockedReason && (
          <RetailCard variant="info" className="p-3 text-sm text-text-primary">
            {blockedReason}
          </RetailCard>
        )}

        <div className="space-y-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-primary">Message type</label>
            <Select value={messageType} onValueChange={(value) => setMessageType(value as 'marketing' | 'service')}>
              <SelectTrigger>
                <SelectValue placeholder="Select message type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-text-secondary">
              Marketing includes unsubscribe automatically. Service does not include unsubscribe or offer by default.
            </p>
          </div>
          <label className="text-sm font-medium text-text-primary">Message</label>
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Write your message..."
            rows={5}
          />
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              {messageType === 'service'
                ? 'Service SMS (no unsubscribe/offer by default)'
                : 'Marketing SMS (unsubscribe link included)'}
            </span>
            <span>{messageBody.length} chars</span>
          </div>
        </div>

        {lastMessage && (
          <RetailCard className="p-3 text-sm text-text-primary">
            <div className="flex items-center justify-between">
              <span>Status: {statusLabel}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                Refresh status
              </Button>
            </div>
            {lastMessage.providerMessageId && (
              <div className="mt-2 text-xs text-text-secondary">
                Provider ID: {lastMessage.providerMessageId}
              </div>
            )}
          </RetailCard>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={
              sendMutation.isPending ||
              !messageBody.trim() ||
              Boolean(blockedReason)
            }
          >
            {sendMutation.isPending ? 'Sending...' : 'Send SMS'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
