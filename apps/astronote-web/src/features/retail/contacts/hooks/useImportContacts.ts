import { useMutation } from '@tanstack/react-query';
import { contactsApi } from '@/src/lib/retail/api/contacts';

export function useImportContacts() {
  return useMutation({
    mutationFn: async (file: File) => {
      const res = await contactsApi.import(file);
      return res.data.jobId;
    },
  });
}

