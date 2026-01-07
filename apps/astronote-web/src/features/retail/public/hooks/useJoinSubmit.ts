import { useMutation } from '@tanstack/react-query';
import { publicApi } from '@/src/lib/retail/api/public';

export interface JoinSubmitPayload {
  firstName: string;
  lastName?: string;
  email?: string;
  phoneCountryCode: string;
  phoneNational: string;
}

export function useJoinSubmit(token: string | null) {
  return useMutation({
    mutationFn: async (payload: JoinSubmitPayload) => {
      if (!token) throw new Error('token required');
      const res = await publicApi.submitJoin(token, payload);
      return res.data;
    },
  });
}
