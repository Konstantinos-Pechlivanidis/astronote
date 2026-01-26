import api from './axios';
import { endpoints } from './endpoints';
import { ContactsListSchema, validateRetailResponse } from './schemas';

export interface Contact {
  id: number
  phone: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  gender?: 'male' | 'female' | 'other' | null
  birthday?: string | null
  isSubscribed?: boolean
  serviceAllowed?: boolean
  createdAt?: string
}

export interface ContactsListParams {
  page?: number
  pageSize?: number
  q?: string
  listId?: number | null
  isSubscribed?: boolean | null
}

export interface ContactsListResponse {
  items: Contact[]
  total: number
  page: number
  pageSize: number
}

export const contactsApi = {
  list: (params?: ContactsListParams) => {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.pageSize) queryParams.pageSize = params.pageSize;
    if (params?.q) queryParams.q = params.q;
    if (params?.listId) queryParams.listId = params.listId;
    if (params?.isSubscribed !== undefined && params.isSubscribed !== null) {
      queryParams.isSubscribed = params.isSubscribed ? 'true' : 'false';
    }
    const baseTransform = api.defaults.transformResponse;
    const baseTransformArray = Array.isArray(baseTransform)
      ? baseTransform
      : baseTransform
        ? [baseTransform]
        : [];
    return api.get<ContactsListResponse>(endpoints.contacts.list, {
      params: queryParams,
      transformResponse: [
        ...baseTransformArray,
        (data) => validateRetailResponse(ContactsListSchema, data, 'contacts.list'),
      ],
    });
  },
  get: (id: number) => api.get<Contact>(endpoints.contacts.detail(id)),
  create: (data: Partial<Contact>) => api.post<Contact>(endpoints.contacts.create, data),
  update: (id: number, data: Partial<Contact>) => api.put<Contact>(endpoints.contacts.update(id), data),
  delete: (id: number) => api.delete(endpoints.contacts.delete(id)),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ jobId: string }>(endpoints.contacts.import, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getImportStatus: (jobId: string) => api.get(endpoints.contacts.importStatus(jobId)),
  downloadTemplate: () => api.get(endpoints.contacts.importTemplate, { responseType: 'blob' }),
};
