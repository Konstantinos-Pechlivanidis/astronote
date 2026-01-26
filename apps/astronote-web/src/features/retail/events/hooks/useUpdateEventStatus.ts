import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type EventStatusUpdatePayload } from '@/src/lib/retail/api/events';
import { toast } from 'sonner';

export function useUpdateEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: EventStatusUpdatePayload }) => {
      const res = await eventsApi.updateStatus(id, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'events'] });
      toast.success('Event updated');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update event';
      toast.error(message);
    },
  });
}
