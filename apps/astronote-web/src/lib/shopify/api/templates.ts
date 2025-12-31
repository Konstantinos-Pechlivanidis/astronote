import shopifyApi from './axios';
/**
 * Template Type Definitions
 */
export interface Template {
  id: string;
  title: string;
  category: string;
  content: string; // SMS message content
  previewImage?: string | null;
  tags?: string[];
  conversionRate?: number | null;
  productViewsIncrease?: number | null;
  clickThroughRate?: number | null;
  averageOrderValue?: number | null;
  customerRetention?: number | null;
  useCount?: number; // Usage count for current shop (if shopId available)
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplatesListParams {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
}

export interface TemplatesListResponse {
  templates: Template[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  categories?: string[];
}

/**
 * Templates API Functions
 */
export const templatesApi = {
  /**
   * List templates with filtering, search, and pagination
   */
  list: async (params?: TemplatesListParams): Promise<TemplatesListResponse> => {
    const queryParams: Record<string, string | number> = {};

    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset !== undefined) queryParams.offset = params.offset;
    if (params?.category) queryParams.category = params.category;
    if (params?.search) queryParams.search = params.search;

    const response = await shopifyApi.get<TemplatesListResponse>('/templates', {
      params: queryParams,
    });
    // Response interceptor already extracts data
    return response as unknown as TemplatesListResponse;
  },

  /**
   * Get template categories
   */
  getCategories: async (): Promise<string[]> => {
    const response = await shopifyApi.get<string[]>('/templates/categories');
    // Response interceptor already extracts data
    return response as unknown as string[];
  },

  /**
   * Get single template by ID
   */
  get: async (id: string): Promise<Template> => {
    const response = await shopifyApi.get<Template>(`/templates/${id}`);
    // Response interceptor already extracts data
    return response as unknown as Template;
  },

  /**
   * Track template usage (for analytics)
   */
  trackUsage: async (id: string): Promise<void> => {
    await shopifyApi.post(`/templates/${id}/track`);
  },
};

