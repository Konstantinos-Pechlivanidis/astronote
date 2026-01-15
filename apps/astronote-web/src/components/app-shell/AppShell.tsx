'use client';

import type { CSSProperties, ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

export type AppShellSidebarProps = {
  pathname: string;
  collapsed: boolean;
  className?: string;
};

export type AppShellTopbarProps = {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileNav: () => void;
};

export type AppShellMobileNavProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  pathname: string;
};

export type AppShellProps = {
  children: ReactNode;

  /**
   * LocalStorage key for sidebar collapsed state.
   * Example: retail-sidebar-collapsed-v2, shopify-sidebar-collapsed-v2
   */
  sidebarStorageKey: string;

  /**
   * CSS custom property name used for sidebar width.
   * Example: --retail-sidebar-width, --shopify-sidebar-width
   */
  sidebarWidthCssVar: `--${string}`;

  /**
   * Content wrapper class that applies left padding on desktop using the CSS var.
   * Example: md:pl-[var(--retail-sidebar-width)]
   */
  desktopContentPaddingClassName: string;

  expandedWidth?: number;
  collapsedWidth?: number;

  themeName?: string; // e.g. retail-light

  Sidebar: ComponentType<AppShellSidebarProps>;
  Topbar: ComponentType<AppShellTopbarProps>;
  MobileNav: ComponentType<AppShellMobileNavProps>;
};

export function AppShell({
  children,
  sidebarStorageKey,
  sidebarWidthCssVar,
  desktopContentPaddingClassName,
  expandedWidth = 280,
  collapsedWidth = 80,
  themeName = 'retail-light',
  Sidebar,
  Topbar,
  MobileNav,
}: AppShellProps) {
  const pathname = usePathname() || '';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Theme: match Retail behavior
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeName);
    document.documentElement.classList.add(themeName);

    return () => {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove(themeName);
    };
  }, [themeName]);

  // Load sidebar collapse state from localStorage (Retail/Shopify parity)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem(sidebarStorageKey);
    if (stored !== null) {
      setCollapsed(stored === 'true');
      return;
    }

    const media = window.matchMedia('(min-width: 1024px)');
    const applyDefault = () => setCollapsed(!media.matches);
    applyDefault();

    const handleChange = () => {
      const nextStored = window.localStorage.getItem(sidebarStorageKey);
      if (nextStored === null) applyDefault();
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [sidebarStorageKey]);

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
        window.localStorage.setItem(sidebarStorageKey, String(next));
      }
      return next;
    });
  };

  const sidebarWidth = collapsed ? collapsedWidth : expandedWidth;
  const shellStyle = useMemo(
    () => ({ [sidebarWidthCssVar]: `${sidebarWidth}px` }) as CSSProperties,
    [sidebarWidthCssVar, sidebarWidth],
  );

  return (
    <div className="min-h-dvh bg-background text-text-primary" style={shellStyle}>
      <Sidebar pathname={pathname} collapsed={collapsed} className="hidden md:flex" />
      <div
        className={`flex min-h-dvh flex-col transition-[padding] duration-300 ${desktopContentPaddingClassName}`}
      >
        <Topbar
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} pathname={pathname} />
    </div>
  );
}


