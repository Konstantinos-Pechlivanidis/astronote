import { useQuery } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';

export function useShopifyTemplates() {
  return useQuery({
    queryKey: ['shopify', 'templates'],
    queryFn: async () => {
      const { data } = await axiosShopify.get('/templates');
      return data?.data || data;
    },
  });
}

