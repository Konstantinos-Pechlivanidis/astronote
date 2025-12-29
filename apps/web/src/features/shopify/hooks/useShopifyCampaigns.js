import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';
import { toast } from 'sonner';

export function useShopifyCampaigns(params = {}) {
  return useQuery({
    queryKey: ['shopify', 'campaigns', params],
    queryFn: async () => {
      const { data } = await axiosShopify.get('/campaigns', { params });
      return data?.data || data;
    },
  });
}

export function useShopifyCampaign(id) {
  return useQuery({
    queryKey: ['shopify', 'campaign', id],
    queryFn: async () => {
      const { data } = await axiosShopify.get(`/campaigns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateShopifyCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignData) => {
      const { data } = await axiosShopify.post('/campaigns', campaignData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });
      toast.success('Campaign created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    },
  });
}

export function useEnqueueShopifyCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }) => {
      const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
      const { data } = await axiosShopify.post(`/campaigns/${id}/enqueue`, {}, { headers });
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });
      toast.success('Campaign enqueued successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to enqueue campaign');
    },
  });
}

export function useDeleteShopifyCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosShopify.delete(`/campaigns/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'campaigns'] });
      toast.success('Campaign deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete campaign');
    },
  });
}

