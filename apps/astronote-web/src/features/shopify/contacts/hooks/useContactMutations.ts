import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  contactsApi,
  type CreateContactRequest,
  type UpdateContactRequest,
  type ImportContactsRequest,
} from '@/src/lib/shopify/api/contacts';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query mutation hooks for contacts
 */

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateContactRequest) => contactsApi.create(data),
    onSuccess: () => {
      // Invalidate contacts surfaces
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.contacts.root() });
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
    mutationFn: ({ id, data }: { id: string; data: UpdateContactRequest }) =>
      contactsApi.update(id, data),
    onSuccess: (data) => {
      // Invalidate contacts list/stats and refresh the specific detail view
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.contacts.root() });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: shopifyQueryKeys.contacts.detail(String(data.id)),
        });
      }
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
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.contacts.root() });
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
      queryClient.invalidateQueries({ queryKey: shopifyQueryKeys.contacts.root() });

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

