'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  CreditCard,
  Settings,
  Zap,
} from 'lucide-react';

type ShopifyNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navItems: ShopifyNavItem[] = [
  { href: '/app/shopify/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/shopify/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/app/shopify/contacts', label: 'Contacts', icon: Users },
  { href: '/app/shopify/templates', label: 'Templates', icon: FileText },
  { href: '/app/shopify/automations', label: 'Automations', icon: Zap },
  { href: '/app/shopify/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/shopify/settings', label: 'Settings', icon: Settings },
];

function isNavActive(item: ShopifyNavItem, pathname: string): boolean {
  if (item.href === '/app/shopify/dashboard') {
    return pathname === '/app/shopify' || pathname === '/app/shopify/dashboard';
  }
  return pathname === item.href || pathname?.startsWith(`${item.href}/`);
}

type ShopifyNavListProps = {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function ShopifyNavList({
  pathname,
  collapsed = false,
  onNavigate,
  className,
}: ShopifyNavListProps) {
  return (
    <div className={cn('space-y-1', collapsed && 'space-y-2', className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-accent-light text-accent'
                : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              collapsed && 'justify-center px-2',
            )}
          >
            <Icon className="h-5 w-5" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="flex-1">{item.label}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

