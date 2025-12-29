import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';

export function useImportJob(jobId, enabled = true) {
  return useQuery({
    queryKey: ['contacts', 'import', jobId],
    queryFn: async () => {
      const res = await contactsApi.getImportStatus(jobId);
      return res.data;
    },
    enabled: enabled && !!jobId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if job is pending or active
      if (data?.status === 'pending' || data?.status === 'active') {
        return 2000;
      }
      // Stop polling if completed or failed
      return false;
    },
  });
}

