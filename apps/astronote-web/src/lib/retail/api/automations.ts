import api from './axios';
import { endpoints } from './endpoints';

export interface Automation {
  id: number
  type: 'welcome_message' | 'birthday_message'
  messageBody: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AutomationsResponse {
  welcome?: Automation
  birthday?: Automation
}

export const automationsApi = {
  list: () => api.get<AutomationsResponse>(endpoints.automations.list),
  get: (type: string) => api.get<Automation>(endpoints.automations.detail(type)),
  update: (type: string, data: Partial<Automation>) =>
    api.put<Automation>(endpoints.automations.update(type), data),
  getStats: (type: string) => api.get(endpoints.automations.stats(type)),
};

