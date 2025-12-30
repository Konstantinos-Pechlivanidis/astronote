'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-accent" />
        <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
      </div>

      <GlassCard>
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-text-tertiary mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Coming Soon</h2>
          <p className="text-text-secondary">
            Settings and preferences are under development.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

