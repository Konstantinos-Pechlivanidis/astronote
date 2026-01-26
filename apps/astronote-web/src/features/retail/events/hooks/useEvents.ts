import { useQuery } from '@tanstack/react-query';
import { eventsApi, type EventsListParams } from '@/src/lib/retail/api/events';

export function useEvents(params?: EventsListParams) {
  return useQuery({
    queryKey: ['retail', 'events', params],
    queryFn: async () => {
      const res = await eventsApi.list(params);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}
