import { useMutation } from '@tanstack/react-query';
import { conversionApi } from '../../../api/modules/conversion';
import { toast } from 'sonner';

export function useConversionSubmit() {
  return useMutation({
    mutationFn: async ({ tagPublicId, phone }) => {
      const res = await conversionApi.submit(tagPublicId, { phone });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Visit confirmed successfully');
    },
    onError: (error) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to confirm visit. Please try again.';
      
      if (code === 'PHONE_REQUIRED') {
        toast.error('Phone number is required');
      } else if (code === 'INVALID_PHONE') {
        toast.error('Please enter a valid phone number');
      } else if (code === 'CONTACT_NOT_FOUND') {
        toast.error('No contact found with this phone number');
      } else {
        toast.error(message);
      }
    },
  });
}

