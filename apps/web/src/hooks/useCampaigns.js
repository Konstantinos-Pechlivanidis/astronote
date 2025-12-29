import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';
import { toast } from 'sonner';

/**
 * Hook for campaigns list
 * GET /campaigns?search=&status=&page=&pageSize=
 */
export function useCampaigns(params = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const { data } = await axiosClient.get('/campaigns', { params });
      // Handle both { data: {...} } and direct response
      return data?.data || data;
    },
  });
}

export function useCampaign(id) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/campaigns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaigns', 'stats'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/campaigns/stats/summary');
      return data;
    },
  });
}

/**
 * Hook for creating campaign
 * POST /campaigns
 * Body: { name, message, audience: { type: "all" | "segment", segmentId? }, includeDiscount?, discountValue? }
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignData) => {
      const { data } = await axiosClient.post('/campaigns', campaignData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Campaign created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    },
  });
}

/**
 * Hook for enqueueing campaign
 * POST /campaigns/:id/enqueue
 * Optional header: Idempotency-Key
 */
export function useEnqueueCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }) => {
      const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
      const { data } = await axiosClient.post(`/campaigns/${id}/enqueue`, {}, { headers });
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Campaign enqueued successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to enqueue campaign');
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campaignData }) => {
      const { data } = await axiosClient.put(`/campaigns/${id}`, campaignData);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', variables.id] });
      toast.success('Campaign updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update campaign');
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosClient.delete(`/campaigns/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete campaign');
    },
  });
}

export function useCampaignMetrics(id) {
  return useQuery({
    queryKey: ['campaign', id, 'metrics'],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/campaigns/${id}/metrics`);
      return data;
    },
    enabled: !!id,
  });
}

