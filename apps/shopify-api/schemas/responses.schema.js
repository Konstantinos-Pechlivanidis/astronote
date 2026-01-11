import { z } from 'zod';

/**
 * Response DTO Schemas
 *
 * These schemas define the contract for API responses consumed by the frontend.
 * Used for validation in tests and optionally at runtime (behind a flag).
 */

/**
 * Template Item DTO (single template in list)
 */
export const templateItemSchema = z.object({
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
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
});

/**
 * Templates List Response DTO
 */
export const templatesListResponseSchema = z.object({
  items: z.array(templateItemSchema),
  templates: z.array(templateItemSchema).optional(), // Backward compatibility
  total: z.number().int().nonnegative(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(20),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }).optional(), // Backward compatibility
  categories: z.array(z.string()).optional(),
});

/**
 * Campaign Item DTO (single campaign in list)
 */
export const campaignItemSchema = z.object({
  id: z.string().min(1, 'Campaign ID must be non-empty'),
  name: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']),
  audience: z.union([
    z.string(),
    z.object({
      type: z.enum(['all', 'segment']),
      segmentId: z.string().optional(),
    }),
  ]),
  discountId: z.string().nullable().optional(),
  scheduleType: z.enum(['immediate', 'scheduled', 'recurring']).optional(),
  scheduleAt: z.string().datetime().nullable().optional(),
  recurringDays: z.number().int().positive().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  createdAt: z.string().datetime().or(z.date()),
  updatedAt: z.string().datetime().or(z.date()),
  // Optional metrics
  totalSent: z.number().int().nonnegative().optional(),
  totalDelivered: z.number().int().nonnegative().optional(),
  totalFailed: z.number().int().nonnegative().optional(),
});

/**
 * Campaigns List Response DTO
 */
export const campaignsListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(campaignItemSchema),
  campaigns: z.array(campaignItemSchema).optional(), // Backward compatibility
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
  }),
});

/**
 * Audience/Segment Item DTO (for select dropdowns)
 */
export const audienceItemSchema = z.object({
  id: z.string().min(1, 'Audience ID must be non-empty'),
  name: z.string().min(1),
  type: z.string().min(1),
  count: z.number().int().nonnegative().optional(),
});

/**
 * Audiences List Response DTO
 */
export const audiencesListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(audienceItemSchema),
  audiences: z.array(audienceItemSchema).optional(), // Backward compatibility
});

/**
 * Discount Item DTO (for select dropdowns)
 */
export const discountItemSchema = z.object({
  id: z.string().min(1, 'Discount ID must be non-empty'),
  code: z.string().min(1),
  title: z.string().optional(),
  value: z.string().optional(),
  type: z.string().optional(),
});

/**
 * Discounts List Response DTO
 */
export const discountsListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.array(discountItemSchema),
  discounts: z.array(discountItemSchema).optional(), // Backward compatibility
});

/**
 * Validate response against schema
 * @param {Object} data - Response data to validate
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} endpoint - Endpoint name for error messages
 * @returns {Object} Validated data
 * @throws {Error} If validation fails
 */
export function validateResponse(data, schema, endpoint = 'unknown') {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const { logger } = require('../utils/logger.js');
      logger.error('Response validation failed', {
        endpoint,
        errors: error.errors,
        dataPreview: JSON.stringify(data).substring(0, 500),
      });
      throw new Error(
        `Invalid response for ${endpoint}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
      );
    }
    throw error;
  }
}

export default {
  templateItemSchema,
  templatesListResponseSchema,
  campaignItemSchema,
  campaignsListResponseSchema,
  audienceItemSchema,
  audiencesListResponseSchema,
  discountItemSchema,
  discountsListResponseSchema,
  validateResponse,
};

