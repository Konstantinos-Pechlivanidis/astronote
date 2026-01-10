import shopifyApi from './axios';

/**
 * Shopify Campaigns API
 * Campaign management endpoints
 */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'paused'
  | 'completed'
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
  totalRecipients?: number; // Alias for recipientCount
  sentCount?: number;
  failedCount?: number;
  deliveredCount?: number;
  priority?: CampaignPriority;
  recurringDays?: number | null;
}

export interface CampaignListParams {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'scheduleAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
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
  stats: {
    total: number;
    byStatus: {
      draft?: number;
      scheduled?: number;
      sending?: number;
      sent?: number;
      failed?: number;
      cancelled?: number;
    };
  };
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

/**
 * List campaigns with filtering and pagination
 */
export async function listCampaigns(
  params?: CampaignListParams,
): Promise<CampaignListResponse> {
  const response = await shopifyApi.get<CampaignListResponse>('/campaigns', {
    params,
  });
  // Response interceptor already extracts data
  return response as unknown as CampaignListResponse;
}

/**
 * Get campaign stats summary
 */
export async function getCampaignStatsSummary(): Promise<CampaignStatsSummary> {
  const response = await shopifyApi.get<CampaignStatsSummary>(
    '/campaigns/stats/summary',
  );
  // Response interceptor already extracts data
  return response as unknown as CampaignStatsSummary;
}

/**
 * Get single campaign by ID
 */
export async function getCampaign(id: string): Promise<Campaign> {
  const response = await shopifyApi.get<Campaign>(`/campaigns/${id}`);
  // Response interceptor already extracts data
  return response as unknown as Campaign;
}

/**
 * Create new campaign
 */
export async function createCampaign(
  data: CreateCampaignRequest,
): Promise<Campaign> {
  const response = await shopifyApi.post<Campaign>('/campaigns', data);
  // Response interceptor already extracts data
  return response as unknown as Campaign;
}

/**
 * Update campaign
 */
export async function updateCampaign(
  id: string,
  data: UpdateCampaignRequest,
): Promise<Campaign> {
  const response = await shopifyApi.put<Campaign>(`/campaigns/${id}`, data);
  // Response interceptor already extracts data
  return response as unknown as Campaign;
}

/**
 * Delete campaign
 */
export async function deleteCampaign(id: string): Promise<void> {
  await shopifyApi.delete(`/campaigns/${id}`);
}

/**
 * Enqueue campaign for sending
 */
export async function enqueueCampaign(id: string): Promise<void> {
  // Generate idempotency key
  let idempotencyKey: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    idempotencyKey = crypto.randomUUID();
  } else {
    // Fallback for environments without crypto.randomUUID
    idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  await shopifyApi.post(
    `/campaigns/${id}/enqueue`,
    {},
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
}

/**
 * Schedule campaign
 */
export async function scheduleCampaign(
  id: string,
  data: ScheduleCampaignRequest,
): Promise<Campaign> {
  const response = await shopifyApi.put<Campaign>(
    `/campaigns/${id}/schedule`,
    data,
  );
  // Response interceptor already extracts data
  return response as unknown as Campaign;
}

/**
 * Cancel campaign (works for both sending and scheduled campaigns)
 */
export async function cancelCampaign(id: string): Promise<Campaign> {
  const response = await shopifyApi.post<Campaign>(`/campaigns/${id}/cancel`, {});
  // Response interceptor already extracts data
  return response as unknown as Campaign;
}

/**
 * Get campaign metrics
 */
export async function getCampaignMetrics(
  id: string,
): Promise<CampaignMetrics> {
  const response = await shopifyApi.get<CampaignMetrics>(
    `/campaigns/${id}/metrics`,
  );
  // Response interceptor already extracts data
  return response as unknown as CampaignMetrics;
}

/**
 * Get campaign status
 */
export async function getCampaignStatus(
  id: string,
): Promise<CampaignStatusResponse> {
  const response = await shopifyApi.get<CampaignStatusResponse>(
    `/campaigns/${id}/status`,
  );
  // Response interceptor already extracts data
  return response as unknown as CampaignStatusResponse;
}

/**
 * Get campaign progress
 */
export async function getCampaignProgress(
  id: string,
): Promise<CampaignProgress> {
  const response = await shopifyApi.get<CampaignProgress>(
    `/campaigns/${id}/progress`,
  );
  // Response interceptor already extracts data
  return response as unknown as CampaignProgress;
}

/**
 * Get campaign preview
 */
export async function getCampaignPreview(
  id: string,
): Promise<CampaignPreview> {
  const response = await shopifyApi.get<CampaignPreview>(
    `/campaigns/${id}/preview`,
  );
  // Response interceptor already extracts data
  return response as unknown as CampaignPreview;
}

/**
 * Get failed recipients for a campaign
 */
export async function getFailedRecipients(
  id: string,
): Promise<FailedRecipientsResponse> {
  const response = await shopifyApi.get<FailedRecipientsResponse>(
    `/campaigns/${id}/failed-recipients`,
  );
  // Response interceptor already extracts data
  return response as unknown as FailedRecipientsResponse;
}

/**
 * Retry failed recipients for a campaign
 */
export async function retryFailedRecipients(id: string): Promise<void> {
  // Generate idempotency key
  let idempotencyKey: string;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    idempotencyKey = crypto.randomUUID();
  } else {
    idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
  await shopifyApi.post(
    `/campaigns/${id}/retry-failed`,
    {},
    {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
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
