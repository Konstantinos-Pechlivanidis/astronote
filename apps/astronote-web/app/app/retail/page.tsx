'use client';

import { useQuery } from '@tanstack/react-query';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { retailClient } from '@/lib/api/retailClient';
import { TrendingUp, MessageSquare, Users, CreditCard } from 'lucide-react';

export default function RetailDashboardPage() {
  // Get KPIs if endpoint exists
  // Note: Using direct axios call since retailClient doesn't expose client
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['retail-kpis'],
    queryFn: async () => {
      const axios = require('axios');
      const token = localStorage.getItem('retail_access_token');
      const baseUrl = (process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '').replace(/\/api$/i, '');
      const response = await axios.get(`${baseUrl}/api/dashboard/kpis`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        withCredentials: true,
      });
      return response.data;
    },
    retry: false, // Don't retry if endpoint doesn't exist
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  // Get balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: () => retailClient.getBalance(),
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <RetailPageHeader title="Dashboard" description="Overview of your SMS campaigns and performance" />

        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
          <RetailCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-text-secondary">Credits Balance</p>
                {(() => {
                  const b: any = balance;
                  const totalCredits =
                    b?.totalCredits ??
                    (b?.balance || 0) +
                      (b?.allowance?.remainingThisPeriod || 0);
                  return (
                    <p className="text-2xl font-bold">
                      {balanceLoading ? '...' : totalCredits.toLocaleString()}
                    </p>
                  );
                })()}
              </div>
              <CreditCard className="h-8 w-8 text-accent" />
            </div>
          </RetailCard>

          <RetailCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-text-secondary">Total Campaigns</p>
                <p className="text-2xl font-bold">
                  {kpisLoading ? '...' : kpis?.totalCampaigns?.toLocaleString() || '0'}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-accent" />
            </div>
          </RetailCard>

          <RetailCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-text-secondary">Messages Sent</p>
                <p className="text-2xl font-bold">
                  {kpisLoading ? '...' : kpis?.totalMessages?.toLocaleString() || '0'}
                </p>
              </div>
              <Users className="h-8 w-8 text-accent" />
            </div>
          </RetailCard>

          <RetailCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm text-text-secondary">Conversions</p>
                <p className="text-2xl font-bold">
                  {kpisLoading ? '...' : kpis?.conversion?.toLocaleString() || '0'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-accent" />
            </div>
          </RetailCard>
        </div>

        <RetailCard>
          <h2 className="mb-4 text-xl font-semibold">Welcome to Astronote</h2>
          <p className="text-text-secondary">
            Your dashboard is ready. Start by creating your first campaign or importing contacts.
          </p>
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}
