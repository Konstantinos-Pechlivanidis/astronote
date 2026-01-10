import api from './axios';
import { endpoints } from './endpoints';

export interface Subscription {
  id: number
  planType?: string | null
  status?: string | null
  active?: boolean
  interval?: 'month' | 'year' | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  includedSmsPerPeriod?: number
  usedSmsThisPeriod?: number
  remainingSmsThisPeriod?: number
  lastBillingError?: string | null
}

export const subscriptionsApi = {
  getCurrent: () => api.get<Subscription>(endpoints.subscriptions.current),

  subscribe: (data: { planType: string; currency?: string }) =>
    api.post<{ sessionId?: string; url?: string; checkoutUrl?: string }>(
      endpoints.subscriptions.subscribe,
      data,
    ),

  update: (data: { planType: string; currency?: string }) =>
    api.post(endpoints.subscriptions.update, data),

  switch: (data: { planType?: string; interval?: 'month' | 'year'; currency?: string; idempotencyKey?: string }) => {
    const { idempotencyKey, ...payload } = data;
    return api.post(endpoints.subscriptions.switch, payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  },

  cancel: (idempotencyKey?: string) =>
    api.post<{ success: boolean }>(endpoints.subscriptions.cancel, {}, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  getPortal: () =>
    api.get<{ portalUrl?: string; url?: string }>(endpoints.subscriptions.portal),
};
