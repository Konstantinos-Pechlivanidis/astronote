import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';
import { toast } from 'sonner';

/**
 * Hook for contacts list
 * GET /contacts?q=&page=&pageSize=
 */
export function useContacts(params = {}) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: async () => {
      // Map 'search' to 'q' if needed
      const apiParams = { ...params };
      if (apiParams.search) {
        apiParams.q = apiParams.search;
        delete apiParams.search;
      }
      const { data } = await axiosClient.get('/contacts', { params: apiParams });
      return data?.data || data;
    },
  });
}

export function useContact(id) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/contacts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useContactStats() {
  return useQuery({
    queryKey: ['contacts', 'stats'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/contacts/stats');
      return data;
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactData) => {
      const { data } = await axiosClient.post('/contacts', contactData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create contact');
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...contactData }) => {
      const { data } = await axiosClient.put(`/contacts/${id}`, contactData);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.id] });
      toast.success('Contact updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update contact');
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await axiosClient.delete(`/contacts/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete contact');
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axiosClient.post('/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contacts imported successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to import contacts');
    },
  });
}

