import { useQuery } from '@tanstack/react-query';
import { templatesApi, type TemplatesListParams } from '@/src/lib/retail/api/templates';

const SYSTEM_USER_ID = 1; // Default system user ID

export interface UseTemplatesParams extends TemplatesListParams {
  tab?: 'system' | 'my' | null
}

/**
 * Hook to fetch templates list
 * @param options - Query parameters including language (required), page, pageSize, q, category, tab
 */
export function useTemplates({
  language = 'en',
  page = 1,
  pageSize = 50,
  q = '',
  category = '',
  tab = null, // "system" | "my" - filters client-side
}: UseTemplatesParams = {} as UseTemplatesParams) {
  // For tab filtering, we need to fetch all items and paginate client-side
  // because backend doesn't support filtering by ownerId
  // Use larger pageSize when filtering by tab to get all items
  const fetchPageSize = tab ? 100 : pageSize; // Fetch more if filtering by tab

  const params: TemplatesListParams = {
    language,
    page: tab ? 1 : page, // Always fetch from page 1 if filtering by tab
    pageSize: fetchPageSize,
    ...(q && { q }),
    ...(category && { category }),
  };

  return useQuery({
    queryKey: ['retail', 'templates', 'list', { ...params, tab }], // Include tab in query key
    queryFn: async () => {
      const res = await templatesApi.list(params);

      let allItems = res.data.items || [];

      // Filter by tab (system vs my) client-side
      if (tab === 'system') {
        allItems = allItems.filter((t) => t.ownerId === SYSTEM_USER_ID);
      } else if (tab === 'my') {
        allItems = allItems.filter((t) => t.ownerId !== SYSTEM_USER_ID);
      }

      // Client-side pagination if filtering by tab
      const total = allItems.length;
      const start = tab ? (page - 1) * pageSize : 0;
      const end = tab ? start + pageSize : allItems.length;
      const paginatedItems = tab ? allItems.slice(start, end) : allItems;

      return {
        items: paginatedItems,
        total,
        page,
        pageSize,
      };
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

