import api from '../axios';
import { endpoints } from '../endpoints';

export const userApi = {
  update: (data) => api.put(endpoints.user.update, data),
  changePassword: (data) => api.put(endpoints.user.changePassword, data),
};

