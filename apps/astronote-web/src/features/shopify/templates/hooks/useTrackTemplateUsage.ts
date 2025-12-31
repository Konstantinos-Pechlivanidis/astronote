import { useMutation } from '@tanstack/react-query';
import { templatesApi } from '@/src/lib/shopify/api/templates';

/**
 * React Query mutation hook for tracking template usage
 */
export function useTrackTemplateUsage() {
  return useMutation({
    mutationFn: (id: string) => templatesApi.trackUsage(id),
    // No invalidation needed - tracking doesn't affect template data
  });
}

