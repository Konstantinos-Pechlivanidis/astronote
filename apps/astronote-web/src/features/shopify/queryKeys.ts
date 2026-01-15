/**
 * Canonical React Query keys for Shopify.
 *
 * Goals:
 * - One source of truth for query keys (prevents stale views after mutations)
 * - Allows invalidating "families" of queries by using stable prefix roots
 */
export const shopifyQueryKeys = {
  dashboard: {
    root: () => ['shopify', 'dashboard'] as const,
    kpis: () => ['shopify', 'dashboard', 'kpis'] as const,
  },
  contacts: {
    root: () => ['shopify', 'contacts'] as const,
    list: (params: unknown = {}) =>
      ['shopify', 'contacts', 'list', params] as const,
    detail: (id: string) => ['shopify', 'contacts', 'detail', id] as const,
    stats: () => ['shopify', 'contacts', 'stats'] as const,
  },
  campaigns: {
    root: () => ['shopify', 'campaigns'] as const,
    list: (params: unknown = {}) =>
      ['shopify', 'campaigns', 'list', params] as const,
    detail: (id: string) => ['shopify', 'campaigns', 'detail', id] as const,
    status: (id: string) => ['shopify', 'campaigns', 'status', id] as const,
    progress: (id: string) => ['shopify', 'campaigns', 'progress', id] as const,
    metrics: (id: string) => ['shopify', 'campaigns', 'metrics', id] as const,
    preview: (id: string) => ['shopify', 'campaigns', 'preview', id] as const,
    failedRecipients: (id: string) =>
      ['shopify', 'campaigns', 'failed-recipients', id] as const,
    stats: () => ['shopify', 'campaigns', 'stats'] as const,
  },
  billing: {
    root: () => ['shopify', 'billing'] as const,
    summary: () => ['shopify', 'billing', 'summary'] as const,
    balance: () => ['shopify', 'billing', 'balance'] as const,
    invoicesRoot: () => ['shopify', 'billing', 'invoices'] as const,
    invoices: (params: unknown = {}) =>
      ['shopify', 'billing', 'invoices', params] as const,
    historyRoot: () => ['shopify', 'billing', 'history'] as const,
    history: (params: unknown = {}) =>
      ['shopify', 'billing', 'history', params] as const,
    packages: (currency?: string) =>
      ['shopify', 'billing', 'packages', currency] as const,
    profile: () => ['shopify', 'billing', 'profile'] as const,
    topupCalculate: (credits: number | null, currency?: string) =>
      ['shopify', 'billing', 'topup', 'calculate', credits, currency] as const,
  },
  subscriptions: {
    root: () => ['shopify', 'subscriptions'] as const,
    status: () => ['shopify', 'subscriptions', 'status'] as const,
  },
} as const;


