import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export interface NfcSubmitPayload {
  firstName: string;
  lastName?: string;
  email?: string;
  phoneCountryCode: string;
  phoneNational: string;
  birthday?: string;
  gender?: string;
  gdprConsent: boolean;
}

export function useNfcSubmit(token: string | null) {
  return useMutation({
    mutationFn: async (data: NfcSubmitPayload) => {
      if (!token) throw new Error('token required');
      const res = await publicApi.submitNfc(token, data);
      return res.data;
    },
  });
}
