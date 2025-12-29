import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';
import { toast } from 'sonner';

/**
 * Hook for automations list
 * GET /automations
 */
export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/automations');
      return data?.data || data;
    },
  });
}

export function useAutomationStats() {
  return useQuery({
    queryKey: ['automations', 'stats'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/automations/stats');
      return data;
    },
  });
}

/**
 * Hook for updating automation message
 * PUT /automations/:id
 * Body: { message }
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...automationData }) => {
      const { data } = await axiosClient.put(`/automations/${id}`, automationData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation');
    },
  });
}

/**
 * Hook for toggling automation active/inactive
 * PUT /automations/:id/status (or PUT /automations/:id with { active })
 */
export function useToggleAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }) => {
      // Try /status endpoint first, fallback to main endpoint
      try {
        const { data } = await axiosClient.put(`/automations/${id}/status`, { active });
        return data?.data || data;
      } catch (error) {
        if (error.response?.status === 404) {
          // Fallback to main endpoint
          const { data } = await axiosClient.put(`/automations/${id}`, { active });
          return data?.data || data;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation status');
    },
  });
}

