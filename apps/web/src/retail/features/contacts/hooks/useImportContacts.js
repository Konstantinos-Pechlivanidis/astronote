import { useMutation } from '@tanstack/react-query';
import { contactsApi } from '../../../api/modules/contacts';
import { toast } from 'sonner';

export function useImportContacts() {
  return useMutation({
    mutationFn: async (file) => {
      const res = await contactsApi.import(file);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Import job created. Processing...');
      return data.jobId;
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to upload file';
      toast.error(message);
    },
  });
}

