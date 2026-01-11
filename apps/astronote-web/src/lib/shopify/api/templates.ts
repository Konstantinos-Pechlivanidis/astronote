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
  eshopType?: string; // eShop type filter (required or derived from shop settings)
  limit?: number;
  offset?: number;
  page?: number; // Retail-aligned pagination
  pageSize?: number; // Retail-aligned pagination
  category?: string;
  search?: string;
  language?: string; // Optional, but will be forced to 'en' (English-only)
}

export interface TemplatesListResponse {
  items?: Template[]; // Retail-aligned field name
  templates: Template[]; // Backward compatibility
  total?: number; // Retail-aligned field
  page?: number; // Retail-aligned field
  pageSize?: number; // Retail-aligned field
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

    // eShop type is required (or will be derived from shop settings on backend)
    if (params?.eshopType) queryParams.eshopType = params.eshopType;

    // Support both page/pageSize (Retail-aligned) and offset/limit (backward compatibility)
    if (params?.page) queryParams.page = params.page;
    if (params?.pageSize) queryParams.pageSize = params.pageSize;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset !== undefined) queryParams.offset = params.offset;

    if (params?.category) queryParams.category = params.category;
    if (params?.search) queryParams.search = params.search;

    // Language is forced to 'en' (English-only for Shopify)
    queryParams.language = 'en';

    const response = await shopifyApi.get<TemplatesListResponse>('/templates', {
      params: queryParams,
    });
    // Response interceptor already extracts data
    const data = response as unknown as TemplatesListResponse;
    // Ensure backward compatibility: if items exists, also set templates
    if (data.items && !data.templates) {
      data.templates = data.items;
    }
    return data;
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

  /**
   * Ensure default templates exist for shop and eShop type
   * Idempotent endpoint that creates missing templates and repairs existing ones
   */
  ensureDefaults: async (eshopType: string): Promise<{
    created: number;
    updated: number;
    repaired: number;
    skipped: number;
    total: number;
  }> => {
    const response = await shopifyApi.post<{
      created: number;
      updated: number;
      repaired: number;
      skipped: number;
      total: number;
    }>(`/templates/ensure-defaults?eshopType=${eshopType}`);
    // Response interceptor already extracts data
    return response as unknown as {
      created: number;
      updated: number;
      repaired: number;
      skipped: number;
      total: number;
    };
  },
};

