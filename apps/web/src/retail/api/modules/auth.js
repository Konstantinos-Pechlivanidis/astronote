import api from '../axios';
import { endpoints } from '../endpoints';

export const authApi = {
  register: (data) => api.post(endpoints.auth.register, data),
  login: (data) => api.post(endpoints.auth.login, data),
  refresh: () => api.post(endpoints.auth.refresh),
  logout: () => api.post(endpoints.auth.logout),
};

