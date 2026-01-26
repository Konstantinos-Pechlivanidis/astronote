import api from './axios';
import { endpoints } from './endpoints';

export type CustomerEventType = 'appointment' | 'membership' | 'stay' | 'purchase' | 'visit' | 'custom';
export type CustomerEventStatus = 'scheduled' | 'completed' | 'canceled' | 'no_show';

export interface CustomerEventContact {
  id: number;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  isSubscribed?: boolean;
  serviceAllowed?: boolean;
}

export interface CustomerEvent {
  id: number;
  ownerId?: number;
  contactId?: number | null;
  phoneE164?: string | null;
  externalRef?: string | null;
  eventType: CustomerEventType;
  status: CustomerEventStatus;
  startAt?: string | null;
  endAt?: string | null;
  meta?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
  contact?: CustomerEventContact | null;
}

export interface EventsListResponse {
  items: CustomerEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventsListParams {
  page?: number;
  pageSize?: number;
  type?: CustomerEventType | null;
  status?: CustomerEventStatus | null;
  contactId?: number | null;
  phone?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface EventCreatePayload {
  contactId?: number | null;
  phone?: string | null;
  eventType: CustomerEventType;
  status?: CustomerEventStatus;
  startAt?: string | null;
  endAt?: string | null;
  externalRef?: string | null;
  meta?: Record<string, any> | null;
}

export interface EventStatusUpdatePayload {
  status: CustomerEventStatus;
  startAt?: string | null;
  endAt?: string | null;
}

export const eventsApi = {
  list: (params?: EventsListParams) => {
    const queryParams: Record<string, string | number> = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.pageSize) queryParams.pageSize = params.pageSize;
    if (params?.type) queryParams.type = params.type;
    if (params?.status) queryParams.status = params.status;
    if (params?.contactId) queryParams.contactId = params.contactId;
    if (params?.phone) queryParams.phone = params.phone;
    if (params?.from) queryParams.from = params.from;
    if (params?.to) queryParams.to = params.to;
    return api.get<EventsListResponse>(endpoints.events.list, { params: queryParams });
  },
  create: (payload: EventCreatePayload) => api.post<CustomerEvent>(endpoints.events.create, payload),
  updateStatus: (id: number, payload: EventStatusUpdatePayload) =>
    api.patch<CustomerEvent>(endpoints.events.updateStatus(id), payload),
};
