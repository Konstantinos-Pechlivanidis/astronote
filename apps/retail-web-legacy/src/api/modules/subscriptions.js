import api from '../axios';
import { endpoints } from '../endpoints';

export const subscriptionsApi = {
  getCurrent: () => api.get(endpoints.subscriptions.current),
  subscribe: (data) => api.post(endpoints.subscriptions.subscribe, data),
  update: (data) => api.post(endpoints.subscriptions.update, data),
  cancel: () => api.post(endpoints.subscriptions.cancel),
  getPortal: () => api.get(endpoints.subscriptions.portal),
};

