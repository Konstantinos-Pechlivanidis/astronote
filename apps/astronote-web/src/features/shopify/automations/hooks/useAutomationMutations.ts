'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  automationsApi,
  type CreateAutomationRequest,
  type UpdateAutomationRequest,
} from '@/src/lib/shopify/api/automations';

/**
 * React Query hook for creating an automation
 */
export function useCreateAutomation() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: CreateAutomationRequest) => {
      const response = await automationsApi.create(data);
      return response;
    },
    onSuccess: () => {
      // Invalidate automations list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Automation created successfully');
      router.push('/app/shopify/automations');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to create automation';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for updating an automation
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAutomationRequest }) => {
      const response = await automationsApi.update(id, data);
      return response;
    },
    onSuccess: () => {
      // Invalidate automations list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Automation updated successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to update automation';
      toast.error(message);
    },
  });
}

/**
 * React Query hook for deleting an automation
 */
export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await automationsApi.delete(id);
    },
    onSuccess: () => {
      // Invalidate automations list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'automations', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'dashboard'] });

      toast.success('Automation deleted successfully');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to delete automation';
      toast.error(message);
    },
  });
}

