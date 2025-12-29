import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';

/**
 * Hook for segments (lists)
 * GET /audiences/segments
 * Returns: { data: { segments: [...] } }
 * Segments include: gender (male/female/unknown), age buckets (18-24, 25-34, etc.)
 */
export function useSegments() {
  return useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      const { data } = await axiosClient.get('/audiences/segments');
      return data?.data || data;
    },
  });
}

/**
 * Hook for segment preview (optional)
 * GET /audiences/segments/:id/preview
 */
export function useSegmentPreview(segmentId) {
  return useQuery({
    queryKey: ['segment', segmentId, 'preview'],
    queryFn: async () => {
      const { data } = await axiosClient.get(`/audiences/segments/${segmentId}/preview`);
      return data?.data || data;
    },
    enabled: !!segmentId,
  });
}

