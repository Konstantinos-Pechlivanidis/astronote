import { useMutation } from '@tanstack/react-query';
import { userApi, type PasswordChangeData } from '@/src/lib/retail/api/user';
import { toast } from 'sonner';

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: PasswordChangeData) => {
      await userApi.changePassword(data);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to change password';
      toast.error(message);
    },
  });
}

