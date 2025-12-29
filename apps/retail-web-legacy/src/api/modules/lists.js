import api from '../axios';
import { endpoints } from '../endpoints';

export const listsApi = {
  /**
   * Get all lists (system + user-created)
   * Returns lists with isSystem flag to identify system-generated lists
   */
  list: (params) => api.get(endpoints.lists.list, { params }),
  
  /**
   * Get system lists only (filtered client-side or use predefined lists)
   * For read-only UI, we only want system lists
   */
  getSystemLists: async () => {
    const res = await api.get(endpoints.lists.list);
    // Filter to only system lists (isSystem: true)
    const systemLists = res.data.items?.filter(list => list.isSystem === true) || [];
    return { ...res, data: { ...res.data, items: systemLists, total: systemLists.length } };
  },
};

