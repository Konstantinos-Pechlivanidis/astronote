import api from './axios';
import { endpoints } from './endpoints';

export interface MeResponse {
  user: {
    id: number
    email: string
    senderName?: string
    company?: string
    timezone?: string
  }
}

export const meApi = {
  get: () => api.get<MeResponse>(endpoints.me),
};

