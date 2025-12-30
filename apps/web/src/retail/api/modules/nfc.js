import api from '../axios';
import { endpoints } from '../endpoints';

// Public endpoints (no auth required)
export const nfcApi = {
  getConfig: (publicId) => api.get(endpoints.public.nfcConfig(publicId)),
  submit: (publicId, data) => api.post(endpoints.public.nfcSubmit(publicId), data),
};

