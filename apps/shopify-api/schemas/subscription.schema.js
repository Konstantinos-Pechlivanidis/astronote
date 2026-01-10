import { z } from 'zod';

export const subscriptionSubscribeSchema = z.object({
  planType: z.enum(['starter', 'pro'], {
    errorMap: () => ({ message: 'Plan type must be "starter" or "pro"' }),
  }),
});

export const subscriptionUpdateSchema = z.object({
  planType: z.enum(['starter', 'pro'], {
    errorMap: () => ({ message: 'Plan type must be "starter" or "pro"' }),
  }),
});

export const subscriptionSwitchSchema = z
  .object({
    planType: z
      .enum(['starter', 'pro'], {
        errorMap: () => ({ message: 'Plan type must be "starter" or "pro"' }),
      })
      .optional(),
    interval: z
      .enum(['month', 'year'], {
        errorMap: () => ({ message: 'Interval must be "month" or "year"' }),
      })
      .optional(),
  })
  .refine((data) => data.planType || data.interval, {
    message: 'Either planType or interval must be provided',
    path: ['interval'],
  });

export const subscriptionVerifySessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});
