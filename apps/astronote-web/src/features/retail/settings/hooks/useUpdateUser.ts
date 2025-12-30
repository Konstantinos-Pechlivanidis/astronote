import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, type UserUpdateData } from '@/src/lib/retail/api/user';
import { toast } from 'sonner';

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserUpdateData) => {
      const res = await userApi.update(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail', 'me'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    },
  });
}

