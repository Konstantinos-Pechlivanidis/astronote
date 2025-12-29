import { useQuery } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';

/**
 * Hook for retail dashboard data
 * GET /dashboard
 * Expects: { data: { kpis, credits, campaigns, reports } }
 * Reports embedded: last7Days, topCampaigns, deliveryRateTrend, creditsUsage
 */
export function useRetailDashboard() {
  return useQuery({
    queryKey: ['retail', 'dashboard'],
    queryFn: async () => {
      const { data } = await axiosRetail.get('/dashboard');
      return data?.data || data;
    },
  });
}

