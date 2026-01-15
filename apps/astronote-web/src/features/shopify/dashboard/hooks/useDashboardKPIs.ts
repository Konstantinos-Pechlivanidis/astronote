'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardKPIs } from '@/src/lib/shopify/api/dashboard';
import { billingApi } from '@/src/lib/shopifyBillingApi';
import { shopifyQueryKeys } from '@/src/features/shopify/queryKeys';

/**
 * React Query hook for Shopify Dashboard KPIs
 * Fetches dashboard data and billing balance
 */
export function useDashboardKPIs() {
  // Check if token exists (shop context available)
  const hasToken =
    typeof window !== 'undefined' ? !!localStorage.getItem('shopify_token') : false;

  // Fetch dashboard KPIs
  const dashboardQuery = useQuery({
    queryKey: shopifyQueryKeys.dashboard.kpis(),
    queryFn: async () => {
      const data = await dashboardApi.getKPIs();
      return data;
    },
    enabled: hasToken,
    staleTime: 10 * 1000, // 10 seconds (dashboard should feel live)
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  // Fetch billing summary (source of truth for wallet + included allowance)
  const summaryQuery = useQuery({
    queryKey: shopifyQueryKeys.billing.summary(),
    queryFn: async () => {
      return await billingApi.getSummary();
    },
    enabled: hasToken,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  // Normalize data for UI
  const dashboard = dashboardQuery.data || ({} as DashboardKPIs);
  const summary = summaryQuery.data || null;

  // "Credits" shown on dashboard should reflect total available sending capacity:
  // included allowance remaining + wallet credits balance.
  const credits =
    (summary?.allowance?.remainingThisPeriod ?? 0) +
    (summary?.credits?.balance ?? 0) ||
    dashboard.credits ||
    0;

  return {
    // Data
    credits,
    totalCampaigns: dashboard.totalCampaigns ?? 0,
    totalContacts: dashboard.totalContacts ?? 0,
    totalMessagesSent: dashboard.totalMessagesSent ?? 0,
    activeAutomations: dashboard.activeAutomations ?? 0,
    currency: summary?.credits?.currency ?? 'EUR',

    // Loading states
    isLoading: dashboardQuery.isLoading || summaryQuery.isLoading,
    isInitialLoad: (dashboardQuery.isLoading && !dashboardQuery.data) || (summaryQuery.isLoading && !summaryQuery.data),

    // Error states
    error: dashboardQuery.error || summaryQuery.error,
    dashboardError: dashboardQuery.error,
    balanceError: summaryQuery.error,

    // Refetch functions
    refetch: () => {
      dashboardQuery.refetch();
      summaryQuery.refetch();
    },
    refetchDashboard: dashboardQuery.refetch,
    refetchBalance: summaryQuery.refetch,
  };
}

