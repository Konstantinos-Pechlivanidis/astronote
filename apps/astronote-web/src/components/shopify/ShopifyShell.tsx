'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  CreditCard,
  Settings,
  Zap,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/app/shopify/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/shopify/campaigns', label: 'Campaigns', icon: MessageSquare },
  { href: '/app/shopify/contacts', label: 'Contacts', icon: Users },
  { href: '/app/shopify/templates', label: 'Templates', icon: FileText },
  { href: '/app/shopify/automations', label: 'Automations', icon: Zap },
  { href: '/app/shopify/billing', label: 'Billing', icon: CreditCard },
  // Reports page is DEFERRED - DO NOT IMPLEMENT (per requirements)
  { href: '/app/shopify/settings', label: 'Settings', icon: Settings },
];

export function ShopifyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
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

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 glass border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/app/shopify/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-semibold text-text-primary">Astronote</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[44px]',
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
            className="w-full justify-start min-h-[44px]"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

