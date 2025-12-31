'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/app/sidebar';
import { TopBar } from '@/components/app/topbar';
import { ReactNode } from 'react';

export default function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip auth check for shopify routes - they have their own layout (ShopifyShell)
    if (pathname?.startsWith('/app/shopify')) {
      return;
    }

    // Check if user is authenticated
    const retailToken = localStorage.getItem('retail_access_token');
    const shopifyToken = localStorage.getItem('shopify_access_token');

    if (!retailToken && !shopifyToken) {
      router.push('/auth');
    }
  }, [router, pathname]);

  // Skip layout for shopify routes - they have their own layout (ShopifyShell)
  if (pathname?.startsWith('/app/shopify')) {
    return <>{children}</>;
  }

  // Determine service type from pathname
  const serviceType = pathname?.includes('/shopify') ? 'shopify' : 'retail';

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar serviceType={serviceType} />
      <div className="flex-1 flex flex-col">
        <TopBar serviceType={serviceType} />
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

