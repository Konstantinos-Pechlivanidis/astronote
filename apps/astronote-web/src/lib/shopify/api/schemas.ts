/**
 * Frontend Zod Schemas for Shopify API Responses
 *
 * These schemas parse and validate API responses at runtime.
 * Use these to ensure type safety and prevent runtime errors from missing/invalid fields.
 */

import { z } from 'zod';
import { SHOPIFY_CAMPAIGN_STATUS_VALUES } from '../constants/campaign-status';

/**
 * Template DTO Schema
 */
export const templateSchema = z.object({
  id: z.string().min(1, 'Template ID must be non-empty'),
  name: z.string().min(1),
  title: z.string().optional(), // Legacy field
  category: z.string().min(1),
  text: z.string().min(1),
  content: z.string().optional(), // Legacy field
  language: z.string().default('en'),
  goal: z.string().nullable().optional(),
  suggestedMetrics: z.string().nullable().optional(),
  eshopType: z.string().min(1),
  previewImage: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  useCount: z.number().int().nonnegative().default(0),
  conversionRate: z.number().nullable().optional(),
  productViewsIncrease: z.number().nullable().optional(),
  clickThroughRate: z.number().nullable().optional(),
  averageOrderValue: z.number().nullable().optional(),
  customerRetention: z.number().nullable().optional(),
  createdAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
  updatedAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
});

export type TemplateDTO = z.infer<typeof templateSchema>;

/**
 * Templates List Response Schema
 */
export const templatesListResponseSchema = z.object({
  items: z.array(templateSchema),
  templates: z.array(templateSchema).optional(), // Backward compatibility
  total: z.number().int().nonnegative(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(20),
  pagination: z
    .object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNextPage: z.boolean(),
      hasPrevPage: z.boolean(),
    })
    .optional(), // Backward compatibility
  categories: z.array(z.string()).optional(),
});

export type TemplatesListResponseDTO = z.infer<typeof templatesListResponseSchema>;

/**
 * Campaign DTO Schema
 */
export const campaignSchema = z.object({
  id: z.string().min(1, 'Campaign ID must be non-empty'),
  name: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(SHOPIFY_CAMPAIGN_STATUS_VALUES as unknown as [string, ...string[]]),
  statusRaw: z.string().nullable().optional(),
  audience: z.union([
    z.string(),
    z.object({
      type: z.enum(['all', 'segment']),
      segmentId: z.string().optional(),
    }),
  ]),
  discountId: z.string().nullable().optional(),
  scheduleType: z.enum(['immediate', 'scheduled', 'recurring']).optional(),
  scheduleAt: z.string().nullable().optional(),
  recurringDays: z.number().int().positive().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  createdAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
  updatedAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  // Metrics
  recipientCount: z.number().int().nonnegative().default(0),
  sentCount: z.number().int().nonnegative().default(0),
  deliveredCount: z.number().int().nonnegative().default(0),
  failedCount: z.number().int().nonnegative().default(0),
  totalRecipients: z.number().int().nonnegative().default(0),
  totalSent: z.number().int().nonnegative().default(0),
  totalDelivered: z.number().int().nonnegative().default(0),
  totalFailed: z.number().int().nonnegative().default(0),
  totalProcessed: z.number().int().nonnegative().default(0),
  totalClicked: z.number().int().nonnegative().default(0),
  // Canonical contract (new)
  totals: z.object({
    recipients: z.number().int().nonnegative(),
    accepted: z.number().int().nonnegative(),
    sent: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }).nullable().optional(),
  delivery: z.object({
    pendingDelivery: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failedDelivery: z.number().int().nonnegative(),
  }).nullable().optional(),
  sourceOfTruth: z.string().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export type CampaignDTO = z.infer<typeof campaignSchema>;

/**
 * Campaigns List Response Schema
 */
export const campaignsListResponseSchema = z.object({
  campaigns: z.array(campaignSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});

export type CampaignsListResponseDTO = z.infer<typeof campaignsListResponseSchema>;

/**
 * Segment/Audience DTO Schema (for select dropdowns)
 */
export const segmentSchema = z.object({
  id: z.string().min(1, 'Segment ID must be non-empty'),
  name: z.string().min(1),
  type: z.string().min(1),
  count: z.number().int().nonnegative().nullable().optional(),
});

export type SegmentDTO = z.infer<typeof segmentSchema>;

/**
 * Discount DTO Schema (for select dropdowns)
 */
export const discountSchema = z.object({
  id: z.string().min(1, 'Discount ID must be non-empty'),
  code: z.string().min(1),
  title: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

export type DiscountDTO = z.infer<typeof discountSchema>;

/**
 * Contact DTO Schema
 */
export const contactSchema = z.object({
  id: z.string().min(1, 'Contact ID must be non-empty'),
  phone: z.string().min(1),
  phoneE164: z.string().min(1).optional(), // Backward compatibility
  email: z.string().email().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(), // Backward compatibility
  isSubscribed: z.boolean().default(true),
  smsConsentStatus: z.string().nullable().optional(),
  smsConsent: z.string().nullable().optional(),
  smsConsentAt: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
  updatedAt: z
    .string()
    .or(z.date())
    .transform((val) => (typeof val === 'string' ? val : val.toISOString())),
});

export type ContactDTO = z.infer<typeof contactSchema>;

/**
 * Safe parse with fallback
 * Returns parsed data or fallback if parsing fails
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('Schema validation failed:', result.error.errors);
  }
  return fallback;
}

/**
 * Parse array with filtering (removes invalid items)
 */
export function parseArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
): T[] {
  if (!Array.isArray(data)) return [];
  return data
    .map(item => {
      const result = schema.safeParse(item);
      if (result.success) {
        return result.data;
      }
      return null;
    })
    .filter((item): item is T => item !== null);
}

/**
 * Filter out items with empty IDs (for Select components)
 */
export function filterEmptyIds<T extends { id: string }>(items: T[]): T[] {
  return items.filter(item => {
    const id = item?.id;
    return id && String(id).trim().length > 0;
  });
}

/**
 * Sanitize category for Select component (ensure non-empty)
 */
export function sanitizeCategory(category: unknown): string | null {
  if (typeof category !== 'string') return null;
  const trimmed = category.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const schemas = {
  templateSchema,
  templatesListResponseSchema,
  campaignSchema,
  campaignsListResponseSchema,
  segmentSchema,
  discountSchema,
  contactSchema,
  safeParse,
  parseArray,
  filterEmptyIds,
  sanitizeCategory,
};

export default schemas;

