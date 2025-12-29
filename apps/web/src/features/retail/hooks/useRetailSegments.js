import { useQuery } from '@tanstack/react-query';
import axiosRetail from '@/api/axiosRetail';

/**
 * Hook for retail segments (lists)
 * GET /audiences/segments
 */
export function useRetailSegments() {
  return useQuery({
    queryKey: ['retail', 'segments'],
    queryFn: async () => {
      const { data } = await axiosRetail.get('/audiences/segments');
      return data?.data || data;
    },
  });
}

export function useRetailSegmentPreview(segmentId) {
  return useQuery({
    queryKey: ['retail', 'segment', segmentId, 'preview'],
    queryFn: async () => {
      const { data } = await axiosRetail.get(`/audiences/segments/${segmentId}/preview`);
      return data?.data || data;
    },
    enabled: !!segmentId,
  });
}

