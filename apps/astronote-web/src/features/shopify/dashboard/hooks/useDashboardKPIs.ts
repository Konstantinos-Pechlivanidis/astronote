'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type DashboardKPIs, type BillingBalance } from '@/src/lib/shopify/api/dashboard';

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
    queryKey: ['shopify', 'dashboard', 'kpis'],
    queryFn: async () => {
      const data = await dashboardApi.getKPIs();
      return data;
    },
    enabled: hasToken,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // Fetch billing balance (source of truth for credits)
  const balanceQuery = useQuery({
    queryKey: ['shopify', 'billing', 'balance'],
    queryFn: async () => {
      const data = await dashboardApi.getBalance();
      return data;
    },
    enabled: hasToken,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // Normalize data for UI
  const dashboard = dashboardQuery.data || ({} as DashboardKPIs);
  const balance = balanceQuery.data || ({} as BillingBalance);

  // Credits from billing balance (source of truth) or fallback to dashboard
  const credits = balance.credits ?? dashboard.credits ?? 0;

  return {
    // Data
    credits,
    totalCampaigns: dashboard.totalCampaigns ?? 0,
    totalContacts: dashboard.totalContacts ?? 0,
    totalMessagesSent: dashboard.totalMessagesSent ?? 0,
    activeAutomations: dashboard.activeAutomations ?? 0,
    currency: balance.currency ?? 'EUR',

    // Loading states
    isLoading: dashboardQuery.isLoading || balanceQuery.isLoading,
    isInitialLoad: (dashboardQuery.isLoading && !dashboardQuery.data) || (balanceQuery.isLoading && !balanceQuery.data),

    // Error states
    error: dashboardQuery.error || balanceQuery.error,
    dashboardError: dashboardQuery.error,
    balanceError: balanceQuery.error,

    // Refetch functions
    refetch: () => {
      dashboardQuery.refetch();
      balanceQuery.refetch();
    },
    refetchDashboard: dashboardQuery.refetch,
    refetchBalance: balanceQuery.refetch,
  };
}

