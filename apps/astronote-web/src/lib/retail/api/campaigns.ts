import api from './axios';
import { endpoints } from './endpoints';

export interface Campaign {
  id: number
  name: string
  messageText: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused'
  filterGender?: string | null
  filterAgeGroup?: string | null
  total?: number
  sent?: number
  failed?: number
  processed?: number
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
  createdAt?: string
  stats?: {
    total: number
    sent: number       // delivered
    delivered: number
    failed: number
    pendingDelivery?: number
  }
  lastEnqueueError?: string | null
}

export interface CampaignListParams {
  page?: number
  pageSize?: number
  q?: string
  status?: string | null
  withStats?: boolean
}

export interface CampaignListResponse {
  items: Campaign[]
  total: number
  page: number
  pageSize: number
}

export interface CampaignCreateRequest {
  name: string
  messageText: string
  filterGender?: string | null
  filterAgeGroup?: string | null
  scheduledDate?: string
  scheduledTime?: string
}

export interface CampaignUpdateRequest {
  name?: string
  messageText?: string
  filterGender?: string | null
  filterAgeGroup?: string | null
  scheduledDate?: string
  scheduledTime?: string
}

export interface CampaignPreviewResponse {
  sample: Array<{
    to: string
    text: string
  }>
}

export interface CampaignStatsResponse {
  metrics?: CampaignStatusResponse['metrics']
  total: number
  sent: number
  failed: number
  conversions: number
  unsubscribes: number
}

export interface CampaignEnqueueResponse {
  queued: number
  enqueuedJobs?: number
  campaignId?: number
  status?: string
}

export interface CampaignStatusResponse {
  campaign: Campaign
  metrics?: {
    total?: number
    queued: number
    processing: number
    accepted: number
    delivered: number
    deliveryFailed: number
    pendingDelivery: number
    processed: number
  }
}

export interface AudiencePreviewRequest {
  filterGender?: string | null
  filterAgeGroup?: string | null
  nameSearch?: string | null
}

export interface AudiencePreviewResponse {
  count: number
  preview?: Array<{
    id: number
    phone: string
    firstName?: string
    lastName?: string
  }>
  hasMore?: boolean
}

export const campaignsApi = {
  list: (params?: CampaignListParams) =>
    api.get<CampaignListResponse>(endpoints.campaigns.list, { params }),

  get: (id: number) => api.get<Campaign>(endpoints.campaigns.detail(id)),

  create: (data: CampaignCreateRequest) =>
    api.post<{ campaign: Campaign; id: number }>(endpoints.campaigns.create, data),

  update: (id: number, data: CampaignUpdateRequest) =>
    api.put<Campaign>(endpoints.campaigns.update(id), data),

  enqueue: (id: number, idempotencyKey: string) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    return api.post<CampaignEnqueueResponse>(endpoints.campaigns.enqueue(id), {}, { headers });
  },

  schedule: (id: number, data: { scheduledDate: string; scheduledTime: string }) =>
    api.post<Campaign>(endpoints.campaigns.schedule(id), data),

  unschedule: (id: number) => api.post<Campaign>(endpoints.campaigns.unschedule(id), {}),

  getStatus: (id: number) => api.get<CampaignStatusResponse>(endpoints.campaigns.status(id)),

  getStats: (id: number) => api.get<CampaignStatsResponse>(endpoints.campaigns.stats(id)),

  getPreview: (id: number) => api.get<CampaignPreviewResponse>(endpoints.campaigns.preview(id)),

  previewAudience: (data: AudiencePreviewRequest) =>
    api.post<AudiencePreviewResponse>(endpoints.campaigns.previewAudience, data),
};
