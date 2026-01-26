import api from './axios';
import { endpoints } from './endpoints';
import type { BusinessProfile } from '@/src/lib/retail/types';

export interface MeResponse {
  user: {
    id: number
    email: string
    senderName?: string
    company?: string
    timezone?: string
    businessProfile?: BusinessProfile
  }
}

export const meApi = {
  get: () => api.get<MeResponse>(endpoints.me),
};
