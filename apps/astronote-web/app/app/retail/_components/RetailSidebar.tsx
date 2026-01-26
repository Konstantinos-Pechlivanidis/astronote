'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/src/components/retail/ConfirmDialog';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
import RetailLogo from '@/logo/astronote-logo-1200x1200.png';
import { RetailNavList } from './RetailNavList';

type RetailSidebarProps = {
  pathname: string;
  collapsed: boolean;
  className?: string;
};

const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export function RetailSidebar({
  pathname,
  collapsed,
  className,
}: RetailSidebarProps) {
  const { logout, user } = useRetailAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/retail/login';
  };

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex-col',
        'glass border-r border-border bg-background-elevated/90 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-background-elevated/70',
        className,
      )}
      style={{ width: sidebarWidth }}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'px-6',
        )}
      >
        <Link href="/app/retail/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-surface">
            <Image
              src={RetailLogo}
              alt="Astronote"
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-text-primary">Astronote</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Retail navigation">
        <RetailNavList pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="border-t border-border px-4 pb-6 pt-4">
        {user && !collapsed && (
          <div className="px-2 pb-3 text-xs text-text-tertiary">
            <div className="truncate">{user.email}</div>
            {(user.company || user.senderName) && (
              <div className="truncate text-text-tertiary/80">
                {user.company || user.senderName}
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start text-text-secondary hover:text-text-primary',
            collapsed && 'justify-center',
          )}
          onClick={() => setLogoutOpen(true)}
        >
          <LogOut className={cn('h-4 w-4', collapsed ? '' : 'mr-2')} />
          {!collapsed && 'Sign Out'}
        </Button>
        <ConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          onClose={() => setLogoutOpen(false)}
          onConfirm={handleLogout}
          title="Sign out"
          message="Are you sure you want to sign out?"
          confirmText="Sign out"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </aside>
  );
}
