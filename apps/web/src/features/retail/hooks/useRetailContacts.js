import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';
import { toast } from 'sonner';

/**
 * Hook for retail contacts list
 * GET /contacts?q=&page=&pageSize=
 */
export function useRetailContacts(params = {}) {
  return useQuery({
    queryKey: ['retail', 'contacts', params],
    queryFn: async () => {
      const apiParams = { ...params };
      if (apiParams.search) {
        apiParams.q = apiParams.search;
        delete apiParams.search;
      }
      const { data } = await axiosRetail.get('/contacts', { params: apiParams });
      return data?.data || data;
    },
  });
}

export function useImportRetailContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axiosRetail.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'contacts'] });
      toast.success('Contacts imported successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to import contacts');
    },
  });
}

