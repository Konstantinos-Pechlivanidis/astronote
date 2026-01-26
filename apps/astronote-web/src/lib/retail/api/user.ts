import api from './axios';
import { endpoints } from './endpoints';
import type { BusinessProfile } from '@/src/lib/retail/types';

export interface UserUpdateData {
  company?: string | null
  senderName?: string | null
  timezone?: string | null
  businessProfile?: BusinessProfile | null
}

export interface PasswordChangeData {
  currentPassword: string
  newPassword: string
}

export const userApi = {
  update: (data: UserUpdateData) => api.put(endpoints.user.update, data),
  changePassword: (data: PasswordChangeData) => api.put(endpoints.user.changePassword, data),
};
