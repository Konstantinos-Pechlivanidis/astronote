import { useQuery } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';

/**
 * Hook for shopify dashboard data
 * GET /dashboard
 */
export function useShopifyDashboard() {
  return useQuery({
    queryKey: ['shopify', 'dashboard'],
    queryFn: async () => {
      const { data } = await axiosShopify.get('/dashboard');
      return data?.data || data;
    },
  });
}

