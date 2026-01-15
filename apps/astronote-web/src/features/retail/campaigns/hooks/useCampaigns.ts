import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { campaignsApi, type CampaignListParams, type CampaignListResponse } from '@/src/lib/retail/api/campaigns';

export function useCampaigns(
  params?: CampaignListParams,
  options?: { refetchInterval?: number | false },
) {
  const queryParams = {
    page: params?.page || 1,
    pageSize: params?.pageSize || 20,
    ...(params?.q && { q: params.q }),
    ...(params?.status && params.status !== 'all' && { status: params.status }),
    withStats: true,
  };

  return useQuery<CampaignListResponse>({
    queryKey: ['retail', 'campaigns', 'list', queryParams],
    queryFn: async () => {
      const res = await campaignsApi.list(queryParams);
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 1000, // 5 seconds (list should reflect sends quickly)
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: options?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

