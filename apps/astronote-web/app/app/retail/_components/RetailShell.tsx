'use client';

import type { ReactNode } from 'react';
import { RetailMobileNav } from './RetailMobileNav';
import { RetailSidebar } from './RetailSidebar';
import { RetailTopbar } from './RetailTopbar';
import { AppShell } from '@/src/components/app-shell/AppShell';

const SIDEBAR_STORAGE_KEY = 'retail-sidebar-collapsed-v2';

export function RetailLayoutShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebarStorageKey={SIDEBAR_STORAGE_KEY}
      sidebarWidthCssVar="--retail-sidebar-width"
      desktopContentPaddingClassName="md:pl-[var(--retail-sidebar-width)]"
      disableTransitions
      Sidebar={RetailSidebar}
      Topbar={RetailTopbar}
      MobileNav={RetailMobileNav}
    >
      {children}
    </AppShell>
  );
}

export const RetailShell = RetailLayoutShell;
