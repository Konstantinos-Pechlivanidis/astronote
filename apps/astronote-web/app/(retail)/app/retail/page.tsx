'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/ui/glass-card';
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
      const baseUrl = process.env.NEXT_PUBLIC_RETAIL_API_BASE_URL || 'http://localhost:3001';
      const response = await axios.get(`${baseUrl}/api/dashboard/kpis`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        withCredentials: true,
      });
      return response.data;
    },
    retry: false, // Don't retry if endpoint doesn't exist
  });

  // Get balance
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['retail-balance'],
    queryFn: () => retailClient.getBalance(),
  });

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
              <p className="text-text-secondary text-sm mb-1">Total Campaigns</p>
              <p className="text-2xl font-bold">
                {kpisLoading ? '...' : kpis?.totalCampaigns?.toLocaleString() || '0'}
              </p>
            </div>
            <MessageSquare className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Messages Sent</p>
              <p className="text-2xl font-bold">
                {kpisLoading ? '...' : kpis?.totalMessages?.toLocaleString() || '0'}
              </p>
            </div>
            <Users className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Conversions</p>
              <p className="text-2xl font-bold">
                {kpisLoading ? '...' : kpis?.conversion?.toLocaleString() || '0'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-xl font-semibold mb-4">Welcome to Astronote</h2>
        <p className="text-text-secondary">
          Your dashboard is ready. Start by creating your first campaign or importing contacts.
        </p>
      </GlassCard>
    </div>
  );
}
