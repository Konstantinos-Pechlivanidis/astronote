import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';
import { toast } from 'sonner';

/**
 * Hook for settings
 * GET /settings (or /me + settings if that's the backend contract)
 */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      // Try /settings first, fallback to /me or other endpoint
      try {
        const { data } = await axiosClient.get('/settings');
        return data?.data || data;
      } catch (error) {
        // Fallback to /me if /settings doesn't exist
        if (error.response?.status === 404) {
          const { data } = await axiosClient.get('/me');
          return data?.data || data;
        }
        throw error;
      }
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settingsData) => {
      const { data } = await axiosClient.put('/settings', settingsData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    },
  });
}

