import shopifyApi from './shopify/api/axios';

export type CampaignApiError = {
  success: false;
  code: string;
  message: string;
  requestId?: string;
  status?: number;
};

const normalizeCampaignError = (
  error: unknown,
  fallbackMessage: string,
): CampaignApiError => {
  const err = error as any;
  const responseData = err?.response?.data;

  return {
    success: false,
    code:
      err?.code ||
      responseData?.code ||
      responseData?.error ||
      'UNKNOWN_ERROR',
    message: responseData?.message || err?.message || fallbackMessage,
    requestId: responseData?.requestId || err?.requestId,
    status: err?.response?.status,
  };
};

const safeRequest = async <T>(
  action: () => Promise<T>,
  fallbackMessage: string,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw normalizeCampaignError(error, fallbackMessage);
  }
};

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type CampaignFilterStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type ScheduleType = 'immediate' | 'scheduled' | 'recurring';

export type CampaignPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Campaign {
  id: string;
  name: string;
  message: string;
  status: CampaignStatus;
  scheduleType: ScheduleType;
  scheduleAt?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  audience: string | { type: 'all' | 'segment'; segmentId?: string };
  discountId?: string | null;
  recipientCount?: number;
  totalRecipients?: number;
  sentCount?: number;
  failedCount?: number;
  deliveredCount?: number;
  priority?: CampaignPriority;
  recurringDays?: number | null;
  lastEnqueueError?: string | null;
}

export interface CampaignListParams {
  page?: number;
  pageSize?: number;
  status?: CampaignFilterStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'scheduleAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  items?: Campaign[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CampaignStatsSummary {
  total: number;
  totalCampaigns?: number;
  byStatus: {
    draft?: number;
    scheduled?: number;
    sending?: number;
    sent?: number;
    failed?: number;
    cancelled?: number;
  };
  recent?: Campaign[];
  recentCampaigns?: Campaign[];
}

export interface CampaignMetrics {
  total: number;
  sent: number;
  failed: number;
  delivered?: number;
  conversions?: number;
  unsubscribes?: number;
  conversionRate?: number;
}

export interface CampaignStatusResponse {
  queued: number;
  processed: number;
  sent: number;
  failed: number;
}

export interface CampaignProgress {
  sent: number;
  failed: number;
  pending: number;
  percentage: number;
}

export interface CampaignPreview {
  ok?: boolean;
  reason?: string;
  message?: string;
  canSend?: boolean;
  recipientCount?: number;
  estimatedCost?: number;
  availableCredits?: number;
  remainingAllowance?: number;
  totalAvailable?: number;
  insufficientCredits?: boolean;
  missingCredits?: number;
  errors?: string[];
}

export interface FailedRecipient {
  id: string;
  phoneE164: string;
  error?: string | null;
  failedAt?: string | null;
  contact?: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
}

export interface FailedRecipientsResponse {
  campaignId: string;
  failedCount: number;
  recipients: FailedRecipient[];
}

export interface CreateCampaignRequest {
  name: string;
  message: string;
  audience?: string | { type: 'all' | 'segment'; segmentId?: string };
  discountId?: string | null;
  includeDiscount?: boolean;
  discountValue?: string;
  scheduleType?: ScheduleType;
  scheduleAt?: string;
  recurringDays?: number;
  priority?: CampaignPriority;
}

export interface UpdateCampaignRequest {
  name?: string;
  message?: string;
  audience?: string | { type: 'all' | 'segment'; segmentId?: string };
  discountId?: string | null;
  scheduleType?: ScheduleType;
  scheduleAt?: string | null;
  recurringDays?: number | null;
  priority?: CampaignPriority;
}

export interface ScheduleCampaignRequest {
  scheduleType: ScheduleType;
  scheduleAt: string;
  recurringDays?: number;
}

const buildIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export async function listCampaigns(
  params?: CampaignListParams,
): Promise<CampaignListResponse> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignListResponse>('/campaigns', {
      params,
    });
    const campaigns =
      (response as any)?.campaigns || (response as any)?.items || [];
    return {
      campaigns,
      items: campaigns,
      pagination: (response as any)?.pagination || {
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 20,
        total: campaigns.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }, 'Failed to load campaigns');
}

export async function getCampaignStatsSummary(): Promise<CampaignStatsSummary> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignStatsSummary>(
      '/campaigns/stats/summary',
    );
    return response as unknown as CampaignStatsSummary;
  }, 'Failed to load campaign stats');
}

export async function getCampaign(id: string): Promise<Campaign> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<Campaign>(`/campaigns/${id}`);
    return response as unknown as Campaign;
  }, 'Failed to load campaign');
}

export async function createCampaign(
  data: CreateCampaignRequest,
): Promise<Campaign> {
  return safeRequest(async () => {
    const response = await shopifyApi.post<Campaign>('/campaigns', data);
    return response as unknown as Campaign;
  }, 'Failed to create campaign');
}

export async function updateCampaign(
  id: string,
  data: UpdateCampaignRequest,
): Promise<Campaign> {
  return safeRequest(async () => {
    const response = await shopifyApi.put<Campaign>(`/campaigns/${id}`, data);
    return response as unknown as Campaign;
  }, 'Failed to update campaign');
}

export async function deleteCampaign(id: string): Promise<void> {
  return safeRequest(async () => {
    await shopifyApi.delete(`/campaigns/${id}`);
  }, 'Failed to delete campaign');
}

export async function enqueueCampaign(id: string): Promise<void> {
  return safeRequest(async () => {
    await shopifyApi.post(
      `/campaigns/${id}/enqueue`,
      {},
      {
        headers: {
          'Idempotency-Key': buildIdempotencyKey(),
        },
      },
    );
  }, 'Failed to send campaign');
}

export async function scheduleCampaign(
  id: string,
  data: ScheduleCampaignRequest,
): Promise<Campaign> {
  return safeRequest(async () => {
    const response = await shopifyApi.put<Campaign>(
      `/campaigns/${id}/schedule`,
      data,
    );
    return response as unknown as Campaign;
  }, 'Failed to schedule campaign');
}

export async function cancelCampaign(id: string): Promise<Campaign> {
  return safeRequest(async () => {
    const response = await shopifyApi.post<Campaign>(
      `/campaigns/${id}/cancel`,
      {},
    );
    return response as unknown as Campaign;
  }, 'Failed to cancel campaign');
}

export async function getCampaignMetrics(
  id: string,
): Promise<CampaignMetrics> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignMetrics>(
      `/campaigns/${id}/metrics`,
    );
    return response as unknown as CampaignMetrics;
  }, 'Failed to load campaign metrics');
}

export async function getCampaignStatus(
  id: string,
): Promise<CampaignStatusResponse> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignStatusResponse>(
      `/campaigns/${id}/status`,
    );
    return response as unknown as CampaignStatusResponse;
  }, 'Failed to load campaign status');
}

export async function getCampaignProgress(
  id: string,
): Promise<CampaignProgress> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignProgress>(
      `/campaigns/${id}/progress`,
    );
    return response as unknown as CampaignProgress;
  }, 'Failed to load campaign progress');
}

export async function getCampaignPreview(
  id: string,
): Promise<CampaignPreview> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<CampaignPreview>(
      `/campaigns/${id}/preview`,
    );
    return response as unknown as CampaignPreview;
  }, 'Failed to load campaign preview');
}

export async function getFailedRecipients(
  id: string,
): Promise<FailedRecipientsResponse> {
  return safeRequest(async () => {
    const response = await shopifyApi.get<FailedRecipientsResponse>(
      `/campaigns/${id}/failed-recipients`,
    );
    return response as unknown as FailedRecipientsResponse;
  }, 'Failed to load failed recipients');
}

export async function retryFailedRecipients(id: string): Promise<void> {
  return safeRequest(async () => {
    await shopifyApi.post(
      `/campaigns/${id}/retry-failed`,
      {},
      {
        headers: {
          'Idempotency-Key': buildIdempotencyKey(),
        },
      },
    );
  }, 'Failed to retry failed recipients');
}

export const campaignsApi = {
  list: listCampaigns,
  getStatsSummary: getCampaignStatsSummary,
  get: getCampaign,
  create: createCampaign,
  update: updateCampaign,
  delete: deleteCampaign,
  enqueue: enqueueCampaign,
  schedule: scheduleCampaign,
  cancel: cancelCampaign,
  getMetrics: getCampaignMetrics,
  getStatus: getCampaignStatus,
  getProgress: getCampaignProgress,
  getPreview: getCampaignPreview,
  getFailedRecipients,
  retryFailedRecipients,
};
