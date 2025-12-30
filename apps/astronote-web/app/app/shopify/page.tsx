'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
import { shopifyClient } from '@/lib/api/shopifyClient';
import { TrendingUp, MessageSquare, Users, CreditCard } from 'lucide-react';

export default function ShopifyDashboardPage() {
  // Get dashboard data if endpoint exists
  // Note: Using direct axios call since shopifyClient doesn't expose client
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['shopify-dashboard'],
    queryFn: async () => {
      const axios = require('axios');
      const token = localStorage.getItem('shopify_access_token');
      const shopDomain = localStorage.getItem('shopify_shop_domain');
      const baseUrl = process.env.NEXT_PUBLIC_SHOPIFY_API_BASE_URL || 'http://localhost:3000';
      const response = await axios.get(`${baseUrl}/dashboard`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(shopDomain ? { 'X-Shopify-Shop-Domain': shopDomain } : {}),
        },
      });
      return response.data;
    },
    retry: false,
  });

  // Get balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['shopify-balance'],
    queryFn: () => shopifyClient.getBalance(),
  });

  const kpis = dashboard?.kpis || dashboard?.data?.kpis;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Credits Balance</p>
              <p className="text-2xl font-bold">
                {balanceLoading ? '...' : balance?.balance?.toLocaleString() || 0}
              </p>
            </div>
            <CreditCard className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Active Campaigns</p>
              <p className="text-2xl font-bold">
                {dashboardLoading ? '...' : kpis?.activeCampaigns?.toLocaleString() || '0'}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Total Contacts</p>
              <p className="text-2xl font-bold">
                {dashboardLoading ? '...' : kpis?.totalContacts?.toLocaleString() || '0'}
              </p>
            </div>
            <Users className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Revenue Recovered</p>
              <p className="text-2xl font-bold">
                {dashboardLoading ? '...' : `€${kpis?.revenueRecovered?.toLocaleString() || '0'}`}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-xl font-semibold mb-4">Welcome to Astronote</h2>
        <p className="text-text-secondary">
          Your Shopify store is connected. Start by creating your first campaign or viewing your contacts.
        </p>
      </GlassCard>
    </div>
  );
}
