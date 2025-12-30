'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useRetailAuth } from '@/src/features/retail/auth/useRetailAuth';
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
  { href: '/app/retail/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/retail/campaigns', label: 'Campaigns', icon: MessageSquare, disabled: true },
  { href: '/app/retail/contacts', label: 'Contacts', icon: Users, disabled: true },
  { href: '/app/retail/templates', label: 'Templates', icon: FileText, disabled: true },
  { href: '/app/retail/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/retail/automations', label: 'Automations', icon: Zap, disabled: true },
  { href: '/app/retail/settings', label: 'Settings', icon: Settings, disabled: true },
];

export function RetailShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useRetailAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth/retail/login';
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 glass border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center space-x-2">
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
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const isDisabled = item.disabled;

            if (isDisabled) {
              return (
                <div
                  key={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-not-allowed opacity-50',
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              );
            }

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
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
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

