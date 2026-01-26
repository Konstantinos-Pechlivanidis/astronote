'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  getVisibleNavItems,
  isNavActive,
  NAV_GROUP_ORDER,
  type RetailNavItemGroup,
} from './RetailNavItems';

type RetailNavListProps = {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
};

const groupItems = (pathname: string) => {
  const items = getVisibleNavItems();
  const groups = new Map<RetailNavItemGroup, typeof items>();

  for (const item of items) {
    if (!groups.has(item.group)) {
      groups.set(item.group, []);
    }
    groups.get(item.group)?.push(item);
  }

  return NAV_GROUP_ORDER.filter((group) => groups.has(group)).map((group) => ({
    group,
    items: groups.get(group) ?? [],
    active: (groups.get(group) ?? []).some((item) => isNavActive(item, pathname)),
  }));
};

export function RetailNavList({
  pathname,
  collapsed = false,
  onNavigate,
  className,
}: RetailNavListProps) {
  const grouped = groupItems(pathname);

  return (
    <div className={cn('space-y-6', collapsed && 'space-y-4', className)}>
      {grouped.map(({ group, items }) => (
        <div key={group} className="space-y-2">
          {!collapsed && (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              {group}
            </p>
          )}
          <div className={cn('space-y-1', collapsed && 'space-y-2')}>
            {items.map((item) => {
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
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive
                      ? 'bg-accent-light text-accent'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <Icon className={cn('h-5 w-5', collapsed && 'h-5 w-5')} />
                  {collapsed ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span className="flex-1">{item.label}</span>
                  )}
                  {!collapsed && item.badge && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
