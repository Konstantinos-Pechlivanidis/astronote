'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RetailMobileNav } from './RetailMobileNav';
import { RetailSidebar } from './RetailSidebar';
import { RetailTopbar } from './RetailTopbar';

const SIDEBAR_STORAGE_KEY = 'retail-sidebar-collapsed-v2';
const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export function RetailLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'retail-light');
    document.documentElement.classList.add('retail-light');

    return () => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('retail-light');
    };
  }, []);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
    () => ({ '--retail-sidebar-width': `${sidebarWidth}px` }) as CSSProperties,
    [sidebarWidth],
  );

  return (
    <div className="min-h-dvh bg-background text-text-primary" style={shellStyle}>
      <RetailSidebar
        pathname={pathname}
        collapsed={collapsed}
        className="hidden md:flex"
      />
      <div className="flex min-h-dvh flex-col transition-[padding] duration-300 md:pl-[var(--retail-sidebar-width)]">
        <RetailTopbar
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
      <RetailMobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        pathname={pathname}
      />
    </div>
  );
}

export const RetailShell = RetailLayoutShell;
