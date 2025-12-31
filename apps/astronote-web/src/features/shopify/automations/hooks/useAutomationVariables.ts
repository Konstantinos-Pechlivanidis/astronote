import { useQuery } from '@tanstack/react-query';
import { automationsApi, type AutomationTrigger } from '@/src/lib/shopify/api/automations';

/**
 * React Query hook for getting automation variables for a trigger type
 */
export function useAutomationVariables(triggerType: AutomationTrigger | undefined) {
  return useQuery({
    queryKey: ['shopify', 'automations', 'variables', triggerType],
    queryFn: () => automationsApi.getVariables(triggerType!),
    enabled: !!triggerType,
    staleTime: Infinity, // Variables are static
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

