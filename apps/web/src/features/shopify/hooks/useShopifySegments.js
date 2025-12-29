import { useQuery } from '@tanstack/react-query';
import axiosShopify from '@/api/axiosShopify';

export function useShopifySegments() {
  return useQuery({
    queryKey: ['shopify', 'segments'],
    queryFn: async () => {
      const { data } = await axiosShopify.get('/audiences/segments');
      return data?.data || data;
    },
  });
}

export function useShopifySegmentPreview(segmentId) {
  return useQuery({
    queryKey: ['shopify', 'segment', segmentId, 'preview'],
    queryFn: async () => {
      const { data } = await axiosShopify.get(`/audiences/segments/${segmentId}/preview`);
      return data?.data || data;
    },
    enabled: !!segmentId,
  });
}

