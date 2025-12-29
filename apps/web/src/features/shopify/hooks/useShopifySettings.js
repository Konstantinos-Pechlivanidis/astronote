import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';
import { toast } from 'sonner';

export function useShopifySettings() {
  return useQuery({
    queryKey: ['shopify', 'settings'],
    queryFn: async () => {
      try {
        const { data } = await axiosShopify.get('/settings');
        return data?.data || data;
      } catch (error) {
        if (error.response?.status === 404) {
          const { data } = await axiosShopify.get('/me');
          return data?.data || data;
        }
        throw error;
      }
    },
  });
}

export function useUpdateShopifySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settingsData) => {
      const { data } = await axiosShopify.put('/settings', settingsData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });
}

