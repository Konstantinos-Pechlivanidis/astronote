import { useQuery } from '@tanstack/react-query';
import { messageLogsApi, type MessageLogsListParams } from '@/src/lib/retail/api/messageLogs';

export function useMessageLogs(params?: MessageLogsListParams) {
  return useQuery({
    queryKey: ['retail', 'message-logs', params],
    queryFn: async () => {
      const res = await messageLogsApi.list(params);
      return res.data;
    },
    staleTime: 15 * 1000,
  });
}
