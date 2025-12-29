import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';
import { toast } from 'sonner';

export function useShopifyContacts(params = {}) {
  return useQuery({
    queryKey: ['shopify', 'contacts', params],
    queryFn: async () => {
      const apiParams = { ...params };
      if (apiParams.search) {
        apiParams.q = apiParams.search;
        delete apiParams.search;
      }
      const { data } = await axiosShopify.get('/contacts', { params: apiParams });
      return data?.data || data;
    },
  });
}

export function useImportShopifyContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axiosShopify.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts'] });
      toast.success('Contacts imported successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to import contacts');
    },
  });
}

