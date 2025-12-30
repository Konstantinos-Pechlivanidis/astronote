import api from '../axios';
import { endpoints } from '../endpoints';

export const automationsApi = {
  list: () => api.get(endpoints.automations.list),
  get: (type) => api.get(endpoints.automations.detail(type)),
  update: (type, data) => api.put(endpoints.automations.update(type), data),
  getStats: (type) => api.get(endpoints.automations.stats(type)),
};

