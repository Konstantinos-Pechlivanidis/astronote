'use client';

import { ShopifyMobileNav } from '@/app/app/shopify/_components/ShopifyMobileNav';
import { ShopifySidebar } from '@/app/app/shopify/_components/ShopifySidebar';
import { ShopifyTopbar } from '@/app/app/shopify/_components/ShopifyTopbar';
import type { ReactNode } from 'react';
import { AppShell } from '@/src/components/app-shell/AppShell';

const SIDEBAR_STORAGE_KEY = 'shopify-sidebar-collapsed-v2';

export function ShopifyShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebarStorageKey={SIDEBAR_STORAGE_KEY}
      sidebarWidthCssVar="--shopify-sidebar-width"
      desktopContentPaddingClassName="md:pl-[var(--shopify-sidebar-width)]"
      Sidebar={ShopifySidebar}
      Topbar={ShopifyTopbar}
      MobileNav={ShopifyMobileNav}
    >
      {children}
    </AppShell>
  );
}

