import api from './axios';
import { endpoints } from './endpoints';

export interface Template {
  id: number
  name: string
  text: string
  category?: 'cafe' | 'restaurant' | 'gym' | 'sports_club' | 'generic' | 'hotels' | null
  goal?: string | null
  suggestedMetrics?: string | null
  language?: 'en' | 'gr'
  ownerId?: number
  createdAt?: string
  updatedAt?: string
}

export interface TemplatesListParams {
  language: 'en' | 'gr'
  page?: number
  pageSize?: number
  q?: string
  category?: string
}

export interface TemplatesListResponse {
  items: Template[]
  total: number
  page: number
  pageSize: number
}

export interface TemplateRenderParams {
  contactId?: number
  contact?: {
    firstName?: string
    lastName?: string
    email?: string
  }
}

export const templatesApi = {
  list: (params: TemplatesListParams) => {
    // Language is required by backend
    if (!params.language) {
      params.language = 'en'; // Default to English
    }
    return api.get<TemplatesListResponse>(endpoints.templates.list, { params });
  },
  get: (id: number) => api.get<Template>(endpoints.templates.detail(id)),
  create: (data: Partial<Template>) => api.post<Template>(endpoints.templates.create, data),
  update: (id: number, data: Partial<Template>) =>
    api.put<Template>(endpoints.templates.update(id), data),
  delete: (id: number) => api.delete(endpoints.templates.delete(id)),
  render: (id: number, data: TemplateRenderParams) =>
    api.post<{ text: string }>(endpoints.templates.render(id), data),
  getStats: (id: number) => api.get(endpoints.templates.stats(id)),
};

