'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ShopifyMobileNav } from '@/app/app/shopify/_components/ShopifyMobileNav';
import { ShopifySidebar } from '@/app/app/shopify/_components/ShopifySidebar';
import { ShopifyTopbar } from '@/app/app/shopify/_components/ShopifyTopbar';

const SIDEBAR_STORAGE_KEY = 'shopify-sidebar-collapsed-v2';
const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export function ShopifyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Set retail-light theme on mount (same as Retail)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'retail-light');
    document.documentElement.classList.add('retail-light');

    return () => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('retail-light');
    };
  }, []);

  // Load sidebar collapse state from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
      return;
    }

    const media = window.matchMedia('(min-width: 1024px)');
    const applyDefault = () => setCollapsed(!media.matches);
    applyDefault();

    const handleChange = () => {
      const nextStored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (nextStored === null) applyDefault();
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const shellStyle = useMemo(
    () => ({ '--shopify-sidebar-width': `${sidebarWidth}px` }) as CSSProperties,
    [sidebarWidth],
  );

  return (
    <div className="min-h-dvh bg-background text-text-primary" style={shellStyle}>
      <ShopifySidebar
        pathname={pathname}
        collapsed={collapsed}
        className="hidden md:flex"
      />
      <div className="flex min-h-dvh flex-col transition-[padding] duration-300 md:pl-[var(--shopify-sidebar-width)]">
        <ShopifyTopbar
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
      <ShopifyMobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        pathname={pathname}
      />
    </div>
  );
}

