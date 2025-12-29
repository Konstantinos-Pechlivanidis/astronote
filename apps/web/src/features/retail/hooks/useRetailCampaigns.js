import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';
import { toast } from 'sonner';

/**
 * Hook for retail campaigns list
 * GET /campaigns?search=&status=&page=&pageSize=
 */
export function useRetailCampaigns(params = {}) {
  return useQuery({
    queryKey: ['retail', 'campaigns', params],
    queryFn: async () => {
      const { data } = await axiosRetail.get('/campaigns', { params });
      return data?.data || data;
    },
  });
}

export function useRetailCampaign(id) {
  return useQuery({
    queryKey: ['retail', 'campaign', id],
    queryFn: async () => {
      const { data } = await axiosRetail.get(`/campaigns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Hook for creating retail campaign
 * POST /campaigns
 */
export function useCreateRetailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignData) => {
      const { data } = await axiosRetail.post('/campaigns', campaignData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'dashboard'] });
      toast.success('Campaign created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create campaign');
    },
  });
}

/**
 * Hook for enqueueing retail campaign
 * POST /campaigns/:id/enqueue
 */
export function useEnqueueRetailCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idempotencyKey }) => {
      const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
      const { data } = await axiosRetail.post(`/campaigns/${id}/enqueue`, {}, { headers });
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['retail', 'dashboard'] });
      toast.success('Campaign enqueued successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to enqueue campaign');
    },
  });
}

