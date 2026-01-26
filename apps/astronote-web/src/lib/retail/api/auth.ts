import api from './axios';
import { endpoints } from './endpoints';
import type { BusinessProfile } from '@/src/lib/retail/types';

export interface AuthResponse {
  accessToken: string
  user: {
    id: number
    email: string
    senderName?: string
    company?: string
    businessProfile?: BusinessProfile
  }
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  senderName?: string
  company?: string
}

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>(endpoints.auth.register, data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>(endpoints.auth.login, data),

  refresh: () =>
    api.post<{ accessToken: string }>(endpoints.auth.refresh, {}),

  logout: () =>
    api.post(endpoints.auth.logout, {}),
};
