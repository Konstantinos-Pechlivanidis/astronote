'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';

export function RetailAuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useRetailAuth();
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Set a timeout to prevent infinite loading state
    const timeout = setTimeout(() => {
      setHasChecked(true);
    }, 5000); // Max 5 seconds for auth check

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!loading && !user && hasChecked) {
      router.push('/auth/retail/login');
    }
  }, [user, loading, router, hasChecked]);

  // Show loading only for initial check, not forever
  if (loading && !hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If loading takes too long or user is not authenticated, allow navigation to proceed
  // The redirect will happen via useEffect
  if (!user && hasChecked) {
    return null; // Will redirect
  }

  // If we have a user or are still in initial loading, render children
  // This ensures navigation is never blocked indefinitely
  return <>{children}</>;
}

