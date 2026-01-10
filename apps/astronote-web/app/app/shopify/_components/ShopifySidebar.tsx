'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShopifyNavList } from './ShopifyNavList';

type ShopifySidebarProps = {
  pathname: string;
  collapsed: boolean;
  className?: string;
};

const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export function ShopifySidebar({
  pathname,
  collapsed,
  className,
}: ShopifySidebarProps) {
  const router = useRouter();

  const handleLogout = () => {
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

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex-col',
        'glass border-r border-border bg-background-elevated/90 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-background-elevated/70',
        'transition-[width] duration-200 ease-out',
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
        <Link href="/app/shopify/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-text-primary">Astronote</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Shopify navigation">
        <ShopifyNavList pathname={pathname} collapsed={collapsed} />
      </nav>

      <div className="border-t border-border px-4 pb-6 pt-4">
        {shopDomain && !collapsed && (
          <div className="px-2 pb-3 text-xs text-text-tertiary">
            <div className="truncate">{shopDomain}</div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start text-text-secondary hover:text-text-primary',
            collapsed && 'justify-center',
          )}
          onClick={handleLogout}
        >
          <LogOut className={cn('h-4 w-4', collapsed ? '' : 'mr-2')} />
          {!collapsed && 'Sign Out'}
        </Button>
      </div>
    </aside>
  );
}

