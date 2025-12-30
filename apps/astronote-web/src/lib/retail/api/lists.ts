import api from './axios';
import { endpoints } from './endpoints';

export interface List {
  id: number
  name: string
  isSystem: boolean
  memberCount?: number
}

export interface ListsListResponse {
  items: List[]
  total: number
}

export const listsApi = {
  list: (params?: { page?: number; pageSize?: number }) => {
    return api.get<ListsListResponse>(endpoints.lists.list, { params });
  },
  getSystemLists: async () => {
    const res = await api.get<ListsListResponse>(endpoints.lists.list);
    // Filter to only system lists (isSystem: true)
    const systemLists = res.data.items?.filter((list) => list.isSystem === true) || [];
    return {
      ...res,
      data: {
        ...res.data,
        items: systemLists,
        total: systemLists.length,
      },
    };
  },
  get: (id: number) => api.get<List>(endpoints.lists.detail(id)),
  getContacts: (id: number) => api.get(endpoints.lists.contacts(id)),
};

