import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    senderName: z.string().max(11, 'Sender name must be 11 characters or less').optional().or(z.literal('')),
    company: z.string().max(160, 'Company name must be 160 characters or less').optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200, 'Campaign name must be 200 characters or less'),
  messageText: z
    .string()
    .min(1, 'Message text is required')
    .max(2000, 'Message text must be 2000 characters or less'),
  filterGender: z
    .union([
      z.enum(['male', 'female', 'other']),
      z.literal(''), // Accept empty string for "Any"
    ])
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)), // Transform empty string to null
  filterAgeGroup: z
    .union([
      z.enum(['18_24', '25_39', '40_plus']),
      z.literal(''), // Accept empty string for "Any"
    ])
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val)), // Transform empty string to null
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  scheduledAt: z.string().optional(),
  scheduleType: z.enum(['now', 'later']).optional().default('now'),
});
