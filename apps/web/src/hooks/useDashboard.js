import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';

/**
 * Hook for dashboard data
 * GET /dashboard
 * Expects: { data: { kpis, credits, campaigns, reports } }
 * Reports embedded: last7Days, topCampaigns, deliveryRateTrend, creditsUsage
 */
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/dashboard');
      // Handle both { data: {...} } and direct response
      return data?.data || data;
    },
  });
}

