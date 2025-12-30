import api from '../axios';
import { endpoints } from '../endpoints';

// Public endpoints (no auth required)
export const conversionApi = {
  getConfig: (tagPublicId) => api.get(endpoints.public.conversionConfig(tagPublicId)),
  submit: (tagPublicId, data) => api.post(endpoints.public.conversionSubmit(tagPublicId), data),
};

