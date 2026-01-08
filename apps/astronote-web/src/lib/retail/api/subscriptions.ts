import api from './axios';
import { endpoints } from './endpoints';

export interface Subscription {
  id: number
  planType: string
  status: string
  active: boolean
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

  cancel: () =>
    api.post<{ success: boolean }>(endpoints.subscriptions.cancel, {}),

  getPortal: () =>
    api.get<{ portalUrl?: string; url?: string }>(endpoints.subscriptions.portal),
};
