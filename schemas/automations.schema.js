import { z } from 'zod';

/**
 * Automation Validation Schemas
 * Using Zod for type-safe validation
 */

// Automation trigger enum - must match Prisma AutomationTrigger enum
const automationTriggerSchema = z.enum([
  'welcome',
  'abandoned_cart',
  'order_confirmation',
  'shipping_update',
  'delivery_confirmation',
  'review_request',
  'reorder_reminder',
  'birthday',
  'customer_inactive',
  'cart_abandoned',
  'order_placed',
  'order_fulfilled',
  'cross_sell',
  'upsell',
]);

// Automation status enum
const automationStatusSchema = z.enum(['draft', 'active', 'paused']);

/**
 * Create automation request schema
 */
export const createAutomationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Automation name is required')
    .max(255, 'Automation name must be less than 255 characters'),
  trigger: automationTriggerSchema,
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(1600, 'Message must be less than 1600 characters (SMS limit)'),
  status: automationStatusSchema.optional().default('draft'),
  triggerConditions: z.record(z.any()).optional().default({}),
});

/**
 * Update automation request schema
 */
export const updateAutomationSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(1600, 'Message must be less than 1600 characters (SMS limit)')
    .optional(),
  status: automationStatusSchema.optional(),
  // Support both frontend format (status) and backend format (isActive)
  userMessage: z
    .string()
    .trim()
    .min(10)
    .max(1600)
    .optional(),
  isActive: z.boolean().optional(),
});

/**
 * Automation variables request schema
 */
export const automationVariablesSchema = z.object({
  triggerType: automationTriggerSchema,
});

/**
 * Validate create automation request
 */
export function validateCreateAutomation(data) {
  return createAutomationSchema.parse(data);
}

/**
 * Validate update automation request
 */
export function validateUpdateAutomation(data) {
  return updateAutomationSchema.parse(data);
}

/**
 * Validate automation variables request
 */
export function validateAutomationVariables(data) {
  return automationVariablesSchema.parse(data);
}

export default {
  createAutomationSchema,
  updateAutomationSchema,
  automationVariablesSchema,
  validateCreateAutomation,
  validateUpdateAutomation,
  validateAutomationVariables,
};
