'use client';

import { Lock } from 'lucide-react';
import { ChangePasswordForm } from './ChangePasswordForm';
import { GlassCard } from '@/components/ui/glass-card';

export function SecurityCard() {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-6">
        <Lock className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Security</h2>
      </div>

      <ChangePasswordForm />
    </GlassCard>
  );
}

