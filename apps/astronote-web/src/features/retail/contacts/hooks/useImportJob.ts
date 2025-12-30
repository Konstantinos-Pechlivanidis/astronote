import { useQuery } from '@tanstack/react-query';
import { contactsApi } from '@/src/lib/retail/api/contacts';

export interface ImportJobStatus {
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress?: {
    processed: number
    total: number
  }
  results?: {
    created: number
    skipped: number
    errors?: string[]
  }
  error?: string
}

export function useImportJob(jobId: string | null, enabled = true) {
  return useQuery<ImportJobStatus>({
    queryKey: ['contacts', 'import', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('Job ID is required');
      const res = await contactsApi.getImportStatus(jobId);
      return res.data;
    },
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if job is pending or active
      const data = query.state.data;
      if (data?.status === 'pending' || data?.status === 'active') {
        return 2000;
      }
      // Stop polling if completed or failed
      return false;
    },
  });
}

