import { z } from 'zod';

/**
 * Optional runtime validation for Retail API responses.
 *
 * Enable by setting:
 * - NEXT_PUBLIC_ENABLE_RETAIL_API_VALIDATION=true
 */
const ENABLE =
  typeof process !== 'undefined' &&
  (process.env.NEXT_PUBLIC_ENABLE_RETAIL_API_VALIDATION === 'true' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
    process.env.NODE_ENV === 'development');

export function validateRetailResponse<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  if (!ENABLE) return data as T;
  return schema.parse(data, { path: [label] });
}

export const BillingSummarySchema = z.object({
  credits: z.object({ balance: z.number() }),
  subscription: z
    .object({
      planType: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      active: z.boolean().optional(),
      billingCurrency: z.string().optional(),
      interval: z.enum(['month', 'year']).nullable().optional(),
      currentPeriodStart: z.string().nullable().optional(),
      currentPeriodEnd: z.string().nullable().optional(),
      cancelAtPeriodEnd: z.boolean().optional(),
      includedSmsPerPeriod: z.number().optional(),
      usedSmsThisPeriod: z.number().optional(),
      remainingSmsThisPeriod: z.number().optional(),
      lastBillingError: z.string().nullable().optional(),
    })
    .optional(),
  allowance: z
    .object({
      includedPerPeriod: z.number(),
      usedThisPeriod: z.number(),
      remainingThisPeriod: z.number(),
      currentPeriodStart: z.string().nullable().optional(),
      currentPeriodEnd: z.string().nullable().optional(),
      interval: z.enum(['month', 'year']).nullable().optional(),
    })
    .optional(),
  billingCurrency: z.string().optional(),
});

export const ContactsListSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      phone: z.string(),
      email: z.string().nullable().optional(),
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      gender: z.enum(['male', 'female', 'other']).nullable().optional(),
      birthday: z.string().nullable().optional(),
      isSubscribed: z.boolean().optional(),
      createdAt: z.string().optional(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});


