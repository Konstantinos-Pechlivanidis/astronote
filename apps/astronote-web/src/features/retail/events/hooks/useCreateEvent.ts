import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type EventCreatePayload } from '@/src/lib/retail/api/events';
import { toast } from 'sonner';

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: EventCreatePayload) => {
      const res = await eventsApi.create(payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'events'] });
      toast.success('Event created');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to create event';
      toast.error(message);
    },
  });
}
