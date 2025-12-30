import api from './axios';
import { endpoints } from './endpoints';

export interface KPIsResponse {
  totalCampaigns: number
  totalMessages: number
  sent: number
  sentRate: number
  failed: number
  conversion: number
  conversionRate: number
}

export const dashboardApi = {
  getKPIs: () => api.get<KPIsResponse>(endpoints.dashboard.kpis),
};

