import shopifyApi from './axios';

/**
 * Audience Type Definitions
 */
export interface Audience {
  id: string;
  name: string;
  description: string;
  type: 'predefined' | 'segment';
  contactCount: number;
  isAvailable: boolean;
  segmentId?: number;
}

export interface AudiencesResponse {
  audiences: Audience[];
  totalContacts: number;
  summary: {
    total: number;
    men: number;
    women: number;
    segments: number;
  };
}

export interface AudienceDetailsParams {
  page?: number;
  limit?: number;
}

export interface AudienceDetailsResponse {
  contacts: Array<{
    id: number;
    phoneE164: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ValidateAudienceRequest {
  audienceId: string;
}

export interface ValidateAudienceResponse {
  audienceId: string;
  isValid: boolean;
  contactCount: number;
  error: string | null;
}

/**
 * Audiences API Functions
 */
export const audiencesApi = {
  /**
   * Get available audiences
   */
  list: async (): Promise<AudiencesResponse> => {
    const response = await shopifyApi.get<AudiencesResponse>('/audiences');
    // Response interceptor already extracts data
    return response as unknown as AudiencesResponse;
  },

  /**
   * Get audience details with contact list
   */
  getDetails: async (
    audienceId: string,
    params?: AudienceDetailsParams,
  ): Promise<AudienceDetailsResponse> => {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;

    const response = await shopifyApi.get<AudienceDetailsResponse>(
      `/audiences/${audienceId}/details`,
      { params: queryParams },
    );
    // Response interceptor already extracts data
    return response as unknown as AudienceDetailsResponse;
  },

  /**
   * Validate audience selection
   */
  validate: async (
    data: ValidateAudienceRequest,
  ): Promise<ValidateAudienceResponse> => {
    const response = await shopifyApi.post<ValidateAudienceResponse>(
      '/audiences/validate',
      data,
    );
    // Response interceptor already extracts data
    return response as unknown as ValidateAudienceResponse;
  },
};

