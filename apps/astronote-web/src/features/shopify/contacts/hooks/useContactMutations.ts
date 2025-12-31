import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  contactsApi,
  type CreateContactRequest,
  type UpdateContactRequest,
  type ImportContactsRequest,
} from '@/src/lib/shopify/api/contacts';

/**
 * React Query mutation hooks for contacts
 */

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactRequest) => contactsApi.create(data),
    onSuccess: () => {
      // Invalidate contacts list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'stats'] });
      toast.success('Contact created successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to create contact';
      toast.error(message);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateContactRequest }) =>
      contactsApi.update(id, data),
    onSuccess: (data) => {
      // Invalidate contacts list, detail, and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'detail', data.id] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'stats'] });
      toast.success('Contact updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to update contact';
      toast.error(message);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => contactsApi.delete(id),
    onSuccess: () => {
      // Invalidate contacts list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'stats'] });
      toast.success('Contact deleted successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to delete contact';
      toast.error(message);
    },
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ImportContactsRequest) => contactsApi.import(data),
    onSuccess: (result) => {
      // Invalidate contacts list and stats
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shopify', 'contacts', 'stats'] });

      const message = `Successfully imported ${result.created} contacts, updated ${result.updated}, skipped ${result.skipped}`;
      toast.success(message);

      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} contacts had errors`);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Failed to import contacts';
      toast.error(message);
    },
  });
}

