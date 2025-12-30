import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationsApi } from '../../../api/modules/automations';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

/**
 * Get all automations (welcome and birthday)
 */
export function useAutomations() {
  return useQuery({
    queryKey: queryKeys.automations.list,
    queryFn: async () => {
      const res = await automationsApi.list();
      return res.data; // Returns { welcome: {...}, birthday: {...} }
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get a specific automation by type
 */
export function useAutomation(type) {
  return useQuery({
    queryKey: queryKeys.automations.detail(type),
    queryFn: async () => {
      const res = await automationsApi.get(type);
      return res.data;
    },
    enabled: !!type,
    staleTime: 30 * 1000,
  });
}

/**
 * Update automation (enable/disable or edit message)
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, data }) => {
      const res = await automationsApi.update(type, data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate list and detail queries
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(variables.type) });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.stats(variables.type) });

      const action = variables.data.isActive !== undefined
        ? (variables.data.isActive ? 'enabled' : 'disabled')
        : 'updated';
      toast.success(`Automation ${action} successfully`);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update automation';
      toast.error(message);
    },
    retry: false,
  });
}

/**
 * Toggle automation enabled/disabled status
 */
export function useToggleAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ type, isActive }) => {
      const res = await automationsApi.update(type, { isActive });
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate list and detail queries
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.list });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(variables.type) });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.stats(variables.type) });

      toast.success(`Automation ${variables.isActive ? 'enabled' : 'disabled'} successfully`);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to toggle automation';
      toast.error(message);
    },
    retry: false,
  });
}

/**
 * Get automation statistics
 */
export function useAutomationStats(type) {
  return useQuery({
    queryKey: queryKeys.automations.stats(type),
    queryFn: async () => {
      const res = await automationsApi.getStats(type);
      return res.data;
    },
    enabled: !!type,
    staleTime: 60 * 1000, // 1 minute
  });
}

