import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { campaignsApi, type CampaignListParams, type CampaignListResponse } from '@/src/lib/retail/api/campaigns';

export function useCampaigns(params?: CampaignListParams) {
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
    staleTime: 30 * 1000, // 30 seconds
  });
}

