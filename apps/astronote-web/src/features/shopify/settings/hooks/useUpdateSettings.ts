'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi, type UpdateSettingsRequest } from '@/src/lib/shopify/api/settings';

/**
 * React Query hook for updating settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSettingsRequest) => {
      const response = await settingsApi.updateSettings(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate settings queries
      queryClient.invalidateQueries({ queryKey: ['shopify', 'settings'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'settings', 'account'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'billing', 'packages'] });

      toast.success('Settings saved successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to save settings';
      toast.error(message);
    },
  });
}

