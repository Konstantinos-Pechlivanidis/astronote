'use client';

import { Lock } from 'lucide-react';
import { ChangePasswordForm } from './ChangePasswordForm';
import { RetailCard } from '@/src/components/retail/RetailCard';

export function SecurityCard() {
  return (
    <RetailCard>
      <div className="flex items-center gap-2 mb-6">
        <Lock className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Security</h2>
      </div>

      <ChangePasswordForm />
    </RetailCard>
  );
}
