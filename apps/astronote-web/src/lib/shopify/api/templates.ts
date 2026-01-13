import shopifyApi from './axios';
import {
  templatesListResponseSchema,
  templateSchema,
  filterEmptyIds,
  sanitizeCategory as sanitizeCategoryFromSchema,
} from './schemas';

/**
 * Template Type Definitions
 * Aligned with backend DTO (Retail-aligned fields + backward compatibility)
 */
export interface Template {
  id: string;
  // Retail-aligned fields (primary)
  name: string; // Template name/title
  text: string; // SMS message content
  // Backward compatibility fields
  title?: string; // Deprecated, use name
  content?: string; // Deprecated, use text
  // Category (store-type category name)
  category: string;
  // Metadata
  language?: string;
  goal?: string | null;
  suggestedMetrics?: string | null;
  eshopType?: string;
  previewImage?: string | null;
  tags?: string[];
  // Statistics
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
  templates?: Template[]; // Backward compatibility
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
 * Store-type category display order
 * Used to sort categories in the UI
 */
const STORE_TYPE_CATEGORY_ORDER: readonly string[] = [
  'Fashion & Apparel',
  'Beauty & Cosmetics',
  'Electronics & Gadgets',
  'Home & Living',
  'Health & Wellness',
  'Food & Beverage',
  'Jewelry & Accessories',
  'Baby & Kids',
  'Sports & Fitness',
  'Pet Supplies',
];

/**
 * Sort categories by display order (store-type categories first, then others alphabetically)
 */
export function sortCategories(categories: string[]): string[] {
  const storeTypeCategories = categories.filter(cat =>
    STORE_TYPE_CATEGORY_ORDER.includes(cat),
  ).sort((a, b) => {
    const indexA = STORE_TYPE_CATEGORY_ORDER.indexOf(a);
    const indexB = STORE_TYPE_CATEGORY_ORDER.indexOf(b);
    return indexA - indexB;
  });

  const otherCategories = categories
    .filter(cat => !STORE_TYPE_CATEGORY_ORDER.includes(cat))
    .sort((a, b) => a.localeCompare(b));

  return [...storeTypeCategories, ...otherCategories];
}

/**
 * Get template display name (with fallback)
 */
export function getTemplateName(template: Template): string {
  return template.name || template.title || '(Untitled)';
}

/**
 * Get template display content (with fallback)
 */
export function getTemplateContent(template: Template): string {
  return template.text || template.content || '';
}

/**
 * Sanitize category name (ensure non-empty string)
 */
export function sanitizeCategory(category: unknown): string | null {
  if (typeof category !== 'string') return null;
  const trimmed = category.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Sanitize template ID (ensure non-empty string)
 */
export function sanitizeTemplateId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  return trimmed === '' ? null : trimmed;
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
    const rawData = response as unknown as TemplatesListResponse;

    // Parse and validate with Zod schema
    const parsed = templatesListResponseSchema.safeParse(rawData);
    if (!parsed.success) {
      // Fallback to raw data if parsing fails (defensive)
      console.warn('Template list response validation failed:', parsed.error);
      // Convert raw data to expected type (handle Date -> string conversion)
      const rawItems = (rawData.items || rawData.templates || []) as any[];
      const fallback: TemplatesListResponse = {
        items: rawItems.map((item: any) => ({
          ...item,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : (item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt || ''),
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : (item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt || ''),
        })) as Template[],
        templates: rawItems as Template[],
        total: rawData.total || 0,
        page: rawData.page || 1,
        pageSize: rawData.pageSize || 20,
        pagination: rawData.pagination,
        categories: rawData.categories || [],
      };
      // Sanitize categories
      if (fallback.categories) {
        fallback.categories = fallback.categories
          .map(cat => sanitizeCategoryFromSchema(cat))
          .filter((cat): cat is string => cat !== null);
        fallback.categories = sortCategories(fallback.categories);
      }
      return fallback;
    }

    const parsedData = parsed.data;
    // Convert dates to strings to match Template interface
    const data: TemplatesListResponse = {
      ...parsedData,
      items: parsedData.items.map((item: any) => ({
        ...item,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : (item.createdAt instanceof Date ? item.createdAt.toISOString() : ''),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : (item.updatedAt instanceof Date ? item.updatedAt.toISOString() : ''),
      })) as Template[],
      pagination: parsedData.pagination || {
        page: parsedData.page || 1,
        pageSize: parsedData.pageSize || 20,
        total: parsedData.total || 0,
        totalPages: Math.ceil((parsedData.total || 0) / (parsedData.pageSize || 20)),
        hasNextPage: (parsedData.page || 1) < Math.ceil((parsedData.total || 0) / (parsedData.pageSize || 20)),
        hasPrevPage: (parsedData.page || 1) > 1,
      },
    };
    // Ensure backward compatibility: if items exists, also set templates
    if (data.items && !data.templates) {
      data.templates = data.items;
    }
    // Sanitize and sort categories by display order
    if (data.categories) {
      data.categories = data.categories
        .map(cat => sanitizeCategoryFromSchema(cat))
        .filter((cat): cat is string => cat !== null);
      data.categories = sortCategories(data.categories);
    }
    // Filter out templates with empty IDs (for Select components)
    data.items = data.items ? filterEmptyIds(data.items) : [];
    data.templates = data.templates ? filterEmptyIds(data.templates) : [];
    return data;
  },

  /**
   * Get template categories
   */
  getCategories: async (): Promise<string[]> => {
    const response = await shopifyApi.get<string[]>('/templates/categories');
    // Response interceptor already extracts data
    const categories = response as unknown as string[];
    // Sanitize and sort categories
    const sanitized = categories
      .map(cat => sanitizeCategory(cat))
      .filter((cat): cat is string => cat !== null);
    return sortCategories(sanitized);
  },

  /**
   * Get single template by ID
   */
  get: async (id: string): Promise<Template> => {
    const response = await shopifyApi.get<Template>(`/templates/${id}`);
    // Response interceptor already extracts data
    const rawData = response as unknown as Template;

    // Parse and validate with Zod schema
    const parsed = templateSchema.safeParse(rawData);
    if (!parsed.success) {
      // Fallback to raw data if parsing fails (defensive)
      console.warn('Template response validation failed:', parsed.error);
      return rawData;
    }

    return parsed.data;
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
