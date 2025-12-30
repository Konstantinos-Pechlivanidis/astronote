import { z } from 'zod';

// Phone validation helper
function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // E.164: starts with +, followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone.trim());
}

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

export const contactSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((val) => isValidE164(val.trim()), {
      message: 'Invalid phone format. Please enter in E.164 format (e.g., +306912345678)',
    }),
  email: z
    .string()
    .email('Invalid email address')
    .max(320, 'Email must be 320 characters or less')
    .optional()
    .or(z.literal('')),
  firstName: z
    .string()
    .max(120, 'First name must be 120 characters or less')
    .optional()
    .or(z.literal('')),
  lastName: z
    .string()
    .max(120, 'Last name must be 120 characters or less')
    .optional()
    .or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  birthday: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const date = new Date(val);
        const now = new Date();
        return date < now && !isNaN(date.getTime());
      },
      {
        message: 'Birthday must be a valid date in the past',
      },
    )
    .or(z.literal(''))
    .nullable(),
  isSubscribed: z.boolean().optional(),
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
  scheduleType: z.enum(['now', 'later']).optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  scheduledAt: z.string().optional(),
});

export const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200, 'Template name must be 200 characters or less'),
  text: z.string().min(1, 'Template text is required').max(2000, 'Template text must be 2000 characters or less'),
  category: z.enum(['cafe', 'restaurant', 'gym', 'sports_club', 'generic', 'hotels']).optional().default('generic'),
  goal: z.string().max(200, 'Goal must be 200 characters or less').optional().or(z.literal('')),
  suggestedMetrics: z.string().max(500, 'Suggested metrics must be 500 characters or less').optional().or(z.literal('')),
  language: z.enum(['en', 'gr']).optional().default('en'),
});

export const automationMessageSchema = z.object({
  messageBody: z.string().min(1, 'Message body is required').max(2000, 'Message body must be 2000 characters or less'),
  enabled: z.boolean().optional(),
});

export const profileUpdateSchema = z.object({
  company: z.string().max(160, 'Company name must be 160 characters or less').optional().or(z.literal('')),
  senderName: z
    .string()
    .max(11, 'Sender name must be 11 characters or less')
    .regex(/^[a-zA-Z0-9]*$/, 'Sender name must be alphanumeric')
    .optional()
    .or(z.literal('')),
  timezone: z.string().optional().or(z.literal('')), // IANA timezone format
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
