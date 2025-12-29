import api from '../axios';
import { endpoints } from '../endpoints';

export const campaignsApi = {
  list: (params) => api.get(endpoints.campaigns.list, { params }),
  get: (id) => api.get(endpoints.campaigns.detail(id)),
  create: (data) => api.post(endpoints.campaigns.create, data),
  update: (id, data) => api.put(endpoints.campaigns.update(id), data),
  enqueue: (id, idempotencyKey) => {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
    return api.post(endpoints.campaigns.enqueue(id), {}, { headers });
  },
  schedule: (id, data) => api.post(endpoints.campaigns.schedule(id), data),
  unschedule: (id) => api.post(endpoints.campaigns.unschedule(id)),
  getStatus: (id) => api.get(endpoints.campaigns.status(id)),
  getStats: (id) => api.get(endpoints.campaigns.stats(id)),
  getPreview: (id) => api.get(endpoints.campaigns.preview(id)),
  previewAudience: (data) => api.post(endpoints.campaigns.previewAudience, data),
};

