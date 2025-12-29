import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';
import { toast } from 'sonner';

/**
 * Hook for retail settings
 * GET /settings or /me
 */
export function useRetailSettings() {
  return useQuery({
    queryKey: ['retail', 'settings'],
    queryFn: async () => {
      try {
        const { data } = await axiosRetail.get('/settings');
        return data?.data || data;
      } catch (error) {
        if (error.response?.status === 404) {
          const { data } = await axiosRetail.get('/me');
          return data?.data || data;
        }
        throw error;
      }
    },
  });
}

export function useUpdateRetailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settingsData) => {
      const { data } = await axiosRetail.put('/settings', settingsData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });
}

