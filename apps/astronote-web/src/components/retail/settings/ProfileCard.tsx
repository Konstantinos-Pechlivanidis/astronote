'use client';

import { User } from 'lucide-react';
import { ProfileForm } from './ProfileForm';
import { GlassCard } from '@/components/ui/glass-card';
import type { RetailUser } from '@/src/features/retail/auth/useRetailAuth';

interface ProfileCardProps {
  user?: RetailUser | null
  isLoading?: boolean
}

export function ProfileCard({ user, isLoading }: ProfileCardProps) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-6">
        <User className="w-5 h-5 text-text-secondary" />
        <h2 className="text-lg font-semibold text-text-primary">Account / Profile</h2>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-4 bg-surface-light rounded animate-pulse" />
          <div className="h-4 bg-surface-light rounded animate-pulse w-3/4" />
        </div>
      ) : (
        <ProfileForm user={user} />
      )}
    </GlassCard>
  );
}

