import api from '../axios';
import { endpoints } from '../endpoints';

export const dashboardApi = {
  getKPIs: () => api.get(endpoints.dashboard.kpis),
};

