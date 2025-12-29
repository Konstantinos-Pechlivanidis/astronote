import { useMutation } from '@tanstack/react-query';
import { nfcApi } from '../../../api/modules/nfc';
import { toast } from 'sonner';

export function useNfcSubmit() {
  return useMutation({
    mutationFn: async ({ publicId, data }) => {
      const res = await nfcApi.submit(publicId, data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        data.action === 'created'
          ? 'Thank you! You have been added to our list.'
          : 'Your information has been updated. Thank you!'
      );
    },
    onError: (error) => {
      const code = error.response?.data?.code;
      const message = error.response?.data?.message || 'Failed to submit. Please try again.';
      
      if (code === 'INVALID_PHONE') {
        toast.error('Please enter a valid phone number');
      } else if (code === 'CONSENT_REQUIRED') {
        toast.error('Please provide consent to proceed');
      } else {
        toast.error(message);
      }
    },
  });
}

