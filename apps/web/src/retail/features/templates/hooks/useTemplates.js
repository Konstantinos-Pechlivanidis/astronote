import { useQuery } from '@tanstack/react-query';
import { templatesApi } from '../../../api/modules/templates';
import { queryKeys } from '../../../lib/queryKeys';

/**
 * Hook to fetch templates list
 * @param {Object} options
 * @param {string} options.language - Required: "en" or "gr"
 * @param {number} options.page - Optional, default 1
 * @param {number} options.pageSize - Optional, default 50
 * @param {string} options.q - Optional, search query
 * @param {string} options.category - Optional, category filter
 * @param {string} options.tab - Optional, "system" | "my" - filters client-side by ownerId
 */
export function useTemplates({
  language = 'en',
  page = 1,
  pageSize = 50,
  q = '',
  category = '',
  tab = null, // "system" | "my" - filters client-side
} = {}) {
  // For tab filtering, we need to fetch all items and paginate client-side
  // because backend doesn't support filtering by ownerId
  // Use larger pageSize when filtering by tab to get all items
  const fetchPageSize = tab ? 100 : pageSize; // Fetch more if filtering by tab

  const params = {
    language,
    page: tab ? 1 : page, // Always fetch from page 1 if filtering by tab
    pageSize: fetchPageSize,
    ...(q && { q }),
    ...(category && { category }),
  };

  return useQuery({
    queryKey: queryKeys.templates.list({ ...params, tab }), // Include tab in query key
    queryFn: async () => {
      const res = await templatesApi.list(params);

      // System templates have ownerId = SYSTEM_USER_ID (typically 1)
      // TODO: Get SYSTEM_USER_ID from backend/context if available
      // For now, assume system templates have ownerId = 1 (default from backend config)
      const SYSTEM_USER_ID = 1;

      let allItems = res.data.items || [];

      // Filter by tab (system vs my) client-side
      if (tab === 'system') {
        allItems = allItems.filter(t => t.ownerId === SYSTEM_USER_ID);
      } else if (tab === 'my') {
        allItems = allItems.filter(t => t.ownerId !== SYSTEM_USER_ID);
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
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
  });
}

