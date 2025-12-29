import api from '../axios';
import { endpoints } from '../endpoints';

export const contactsApi = {
  list: (params) => {
    // Include listId in params if provided
    const queryParams = { ...params };
    if (params?.listId) {
      queryParams.listId = params.listId;
    }
    return api.get(endpoints.contacts.list, { params: queryParams });
  },
  get: (id) => api.get(endpoints.contacts.detail(id)),
  create: (data) => api.post(endpoints.contacts.create, data),
  update: (id, data) => api.put(endpoints.contacts.update(id), data),
  delete: (id) => api.delete(endpoints.contacts.delete(id)),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(endpoints.contacts.import, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getImportStatus: (jobId) => api.get(endpoints.contacts.importStatus(jobId)),
  downloadTemplate: () => api.get(endpoints.contacts.importTemplate, { responseType: 'blob' }),
};

