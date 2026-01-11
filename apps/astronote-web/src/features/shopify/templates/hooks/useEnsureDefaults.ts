import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { templatesApi } from '@/src/lib/shopify/api/templates';

/**
 * React Query mutation hook for ensuring default templates exist
 */
export function useEnsureDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eshopType: string) => templatesApi.ensureDefaults(eshopType),
    onSuccess: (data) => {
      // Invalidate templates list to refresh
      queryClient.invalidateQueries({ queryKey: ['shopify', 'templates', 'list'] });

      toast.success(
        `Default templates ensured: ${data.created} created, ${data.updated} updated, ${data.repaired} repaired`,
      );
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Failed to ensure default templates';
      toast.error(message);
    },
  });
}

