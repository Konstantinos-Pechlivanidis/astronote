'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import { getActiveNavItem } from './RetailNavItems';

type RetailTopbarProps = {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileNav: () => void;
  actions?: ReactNode;
  className?: string;
};

export function RetailTopbar({
  pathname,
  collapsed,
  onToggleCollapse,
  onOpenMobileNav,
  actions,
  className,
}: RetailTopbarProps) {
  const { logout, user } = useRetailAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const activeItem = getActiveNavItem(pathname);
  const title = activeItem?.label || 'Retail';

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

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/retail/login';
  };

  const userInitial = (user?.email?.[0] || 'U').toUpperCase();

  return (
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
                {userInitial}
              </span>
            </Button>
            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="User menu"
                className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-background-elevated p-2 shadow-xl"
              >
                {user && (
                  <div className="px-2 pb-2 text-xs text-text-tertiary">
                    <div className="truncate">{user.email}</div>
                    {(user.company || user.senderName) && (
                      <div className="truncate text-text-tertiary/80">
                        {user.company || user.senderName}
                      </div>
                    )}
                  </div>
                )}
                <Link
                  href="/app/retail/settings"
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
                    setLogoutConfirmOpen(true);
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
      <Dialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        title="Sign out"
        size="sm"
      >
        <p className="text-sm text-text-secondary">Are you sure you want to sign out?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setLogoutConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async () => {
              await handleLogout();
            }}
          >
            Sign out
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
