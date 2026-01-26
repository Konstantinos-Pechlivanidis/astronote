import api from './axios';
import { endpoints } from './endpoints';

export type DirectMessageStatus = 'pending' | 'sent' | 'failed'
export type DirectMessageType = 'marketing' | 'service'

export interface DirectMessage {
  id: number
  status: DirectMessageStatus
  deliveryStatus?: string | null
  providerMessageId?: string | null
  creditsCharged?: number | null
  phoneE164: string
  messageBody: string
  messageType?: DirectMessageType
  createdAt?: string
}

export interface SendDirectMessagePayload {
  contactId?: number
  phone?: string
  messageBody: string
  messageType?: DirectMessageType
}

export const directMessagesApi = {
  send: (payload: SendDirectMessagePayload, idempotencyKey?: string) =>
    api.post<DirectMessage>(endpoints.directMessages.send, payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  get: (id: number) => api.get<DirectMessage>(endpoints.directMessages.detail(id)),
  refresh: (id: number) =>
    api.post<{ message: DirectMessage; providerStatus: Record<string, unknown> }>(
      endpoints.directMessages.refresh(id),
    ),
};
