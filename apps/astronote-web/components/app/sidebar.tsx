'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  serviceType: 'retail' | 'shopify'
}

const retailNavItems = [
  { href: '/app/retail', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/retail/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/app/retail/contacts', label: 'Contacts', icon: Users },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/retail/settings', label: 'Settings', icon: Settings },
];

const shopifyNavItems = [
  { href: '/app/shopify', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/shopify/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/app/shopify/contacts', label: 'Contacts', icon: Users },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/shopify/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ serviceType }: SidebarProps) {
  const pathname = usePathname();
  const navItems = serviceType === 'shopify' ? shopifyNavItems : retailNavItems;

  const handleLogout = () => {
    if (serviceType === 'retail') {
      localStorage.removeItem('retail_access_token');
    } else {
      localStorage.removeItem('shopify_access_token');
      localStorage.removeItem('shopify_shop_domain');
    }
    window.location.href = '/auth';
  };

  return (
    <aside className="w-64 glass border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-lg bg-white/90 overflow-hidden border border-border shadow-sm">
            <Image
              src="/logo/astronote-logo-1200x1200.png"
              alt="Astronote logo"
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <span className="text-xl font-semibold text-text-primary">Astronote</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                isActive
                  ? 'bg-accent-light text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
