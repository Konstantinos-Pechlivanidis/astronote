import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';
import { toast } from 'sonner';

/**
 * Hook for retail automations list
 * GET /automations
 */
export function useRetailAutomations() {
  return useQuery({
    queryKey: ['retail', 'automations'],
    queryFn: async () => {
      const { data } = await axiosRetail.get('/automations');
      return data?.data || data;
    },
  });
}

export function useUpdateRetailAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...automationData }) => {
      const { data } = await axiosRetail.put(`/automations/${id}`, automationData);
      return data?.data || data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'automations'] });
      toast.success('Automation updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation');
    },
  });
}

export function useToggleRetailAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }) => {
      try {
        const { data } = await axiosRetail.put(`/automations/${id}/status`, { active });
        return data?.data || data;
      } catch (error) {
        if (error.response?.status === 404) {
          const { data } = await axiosRetail.put(`/automations/${id}`, { active });
          return data?.data || data;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'automations'] });
      toast.success('Automation status updated');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update automation status');
    },
  });
}

