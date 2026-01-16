'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';

type ShopifyTopbarProps = {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileNav: () => void;
  actions?: ReactNode;
  className?: string;
};

// Map pathnames to page titles
const getPageTitle = (pathname: string): string => {
  if (pathname === '/app/shopify' || pathname === '/app/shopify/dashboard') {
    return 'Dashboard';
  }
  if (pathname.startsWith('/app/shopify/campaigns')) {
    return 'Campaigns';
  }
  if (pathname.startsWith('/app/shopify/contacts')) {
    return 'Contacts';
  }
  if (pathname.startsWith('/app/shopify/templates')) {
    return 'Templates';
  }
  if (pathname.startsWith('/app/shopify/automations')) {
    return 'Automations';
  }
  if (pathname.startsWith('/app/shopify/billing')) {
    return 'Billing';
  }
  if (pathname.startsWith('/app/shopify/settings')) {
    return 'Settings';
  }
  return 'Shopify';
};

export function ShopifyTopbar({
  pathname,
  collapsed,
  onToggleCollapse,
  onOpenMobileNav,
  actions,
  className,
}: ShopifyTopbarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = getPageTitle(pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const doLogout = () => {
    // Clear Shopify auth tokens
    if (typeof window !== 'undefined') {
      localStorage.removeItem('shopify_token');
      localStorage.removeItem('shopify_store');
    }
    // Redirect to login
    router.push('/app/shopify/auth/login');
  };

  // Get shop domain from localStorage for display
  const shopDomain =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('shopify_store') || '{}')?.shopDomain || null
      : null;

  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-30 border-b border-border',
          'bg-background-elevated/95 backdrop-blur-sm',
          'supports-[backdrop-filter]:bg-background-elevated/80',
          className,
        )}
      >
        <div className="grid h-14 grid-cols-[auto,1fr,auto] items-center px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onOpenMobileNav}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <div className="min-w-0 text-center md:text-left">
            <span className="text-sm font-semibold text-text-primary">{title}</span>
          </div>

          <div className="flex items-center justify-end gap-2">
            {actions}
            <div className="relative">
              <Button
                ref={buttonRef}
                variant="ghost"
                className="h-9 w-9 rounded-full"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="User menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-semibold text-text-primary">
                  {shopDomain ? shopDomain[0].toUpperCase() : 'S'}
                </span>
              </Button>
              {menuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="User menu"
                  className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-background-elevated p-2 shadow-xl"
                >
                  {shopDomain && (
                    <div className="px-2 pb-2 text-xs text-text-tertiary">
                      <div className="truncate">{shopDomain}</div>
                    </div>
                  )}
                  <Link
                    href="/app/shopify/settings"
                    role="menuitem"
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                  >
                    <Settings className="h-4 w-4" />
                  Account settings
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutOpen(true);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          doLogout();
        }}
        title="Log out"
        message="Are you sure you want to log out?"
        confirmText="Log out"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}

