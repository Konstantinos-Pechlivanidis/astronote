import api from '../axios';
import { endpoints } from '../endpoints';

// Public endpoints (no auth required)
export const trackingApi = {
  getOffer: (trackingId) => api.get(endpoints.public.offer(trackingId)),
  getRedeemStatus: (trackingId) => api.get(endpoints.public.redeemStatus(trackingId)),
};

