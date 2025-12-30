import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meApi } from '../../../api/modules/me';
import { userApi } from '../../../api/modules/user';
import { queryKeys } from '../../../lib/queryKeys';
import { toast } from 'sonner';

/**
 * Get current user profile
 */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const res = await meApi.get();
      return res.data.user; // Backend returns { user: {...} }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Update user profile (company, senderName, timezone)
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const res = await userApi.update(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    },
    retry: false,
  });
}

/**
 * Change user password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data) => {
      const res = await userApi.changePassword(data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to change password';

      if (code === 'AUTHENTICATION_ERROR') {
        toast.error('Invalid current password');
      } else {
        toast.error(message);
      }
    },
    retry: false,
  });
}

