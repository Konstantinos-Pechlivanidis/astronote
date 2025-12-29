import api from '../axios';
import { endpoints } from '../endpoints';

export const meApi = {
  get: () => api.get(endpoints.me),
};

