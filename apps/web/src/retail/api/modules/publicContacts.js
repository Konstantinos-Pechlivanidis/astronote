import api from '../axios';
import { endpoints } from '../endpoints';

// Public endpoints (no auth required)
export const publicContactsApi = {
  getPreferences: (pageToken) => api.get(endpoints.public.preferences(pageToken)),
  unsubscribe: (data) => api.post(endpoints.public.unsubscribe, data),
  resubscribe: (data) => api.post(endpoints.public.resubscribe, data),
};

