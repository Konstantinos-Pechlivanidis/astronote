'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';

export function RetailPublicOnlyGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useRetailAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/app/retail/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

