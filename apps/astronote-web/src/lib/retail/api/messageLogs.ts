import api from './axios';
import { endpoints } from './endpoints';

export type MessageLogSource = 'campaign' | 'automation' | 'automation_library' | 'direct'
export type MessageLogStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'pending'
export type MessageLogType = 'marketing' | 'service'

export interface MessageLogItem {
  id: string
  source: MessageLogSource
  sourceId: number
  sourceName: string
  ownerId: number
  contactId: number | null
  phoneE164: string | null
  messageType: MessageLogType
  status: MessageLogStatus
  deliveryStatus?: string | null
  providerMessageId?: string | null
  creditsCharged?: number | null
  transactionId?: number | null
  createdAt: string
  sentAt?: string | null
  failedAt?: string | null
  deliveredAt?: string | null
}

export interface MessageLogsListParams {
  page?: number
  pageSize?: number
  status?: MessageLogStatus
  messageType?: MessageLogType
  source?: MessageLogSource
  phone?: string
  from?: string
  to?: string
}

export interface MessageLogsResponse {
  items: MessageLogItem[]
  total: number
  page: number
  pageSize: number
}

export const messageLogsApi = {
  list: (params?: MessageLogsListParams) =>
    api.get<MessageLogsResponse>(endpoints.messageLogs.list, { params }),
  exportCsv: (params: { from: string; to: string }) =>
    api.get(endpoints.messageLogs.export, { params, responseType: 'blob' }),
};
