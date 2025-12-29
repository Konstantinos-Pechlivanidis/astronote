import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';
import { toast } from 'sonner';

export function useShopifyAutomations() {
  return useQuery({
    queryKey: ['shopify', 'automations'],
    queryFn: async () => {
      const { data } = await axiosShopify.get('/automations');
      return data?.data || data;
    },
  });
}

export function useUpdateShopifyAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...automationData }) => {
      const { data } = await axiosShopify.put(`/automations/${id}`, automationData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations'] });
      toast.success('Automation updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation');
    },
  });
}

export function useToggleShopifyAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }) => {
      try {
        const { data } = await axiosShopify.put(`/automations/${id}/status`, { active });
        return data?.data || data;
      } catch (error) {
        if (error.response?.status === 404) {
          const { data } = await axiosShopify.put(`/automations/${id}`, { active });
          return data?.data || data;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations'] });
      toast.success('Automation status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation status');
    },
  });
}

