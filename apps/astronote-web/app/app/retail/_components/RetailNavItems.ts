import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Megaphone,
  RadioTower,
  Settings,
  Users,
  Zap,
} from 'lucide-react';

export type RetailNavItemGroup = 'Core' | 'Engage' | 'Revenue' | 'Settings';

export type RetailNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group: RetailNavItemGroup;
  badge?: string | number;
  featureFlag?: string;
  match?: (_pathname: string) => boolean;
};

export const NAV_GROUP_ORDER: RetailNavItemGroup[] = ['Core', 'Engage', 'Revenue', 'Settings'];

const isExactOrChild = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const isNavEnabled = (item: RetailNavItem) => {
  if (!item.featureFlag) return true;
  return process.env[item.featureFlag] === 'true';
};

export const isNavActive = (item: RetailNavItem, pathname: string) =>
  item.match ? item.match(pathname) : isExactOrChild(pathname, item.href);

export const getVisibleNavItems = () => NAV_ITEMS.filter(isNavEnabled);

export const getActiveNavItem = (pathname: string) =>
  getVisibleNavItems().find((item) => isNavActive(item, pathname));

export const NAV_ITEMS: RetailNavItem[] = [
  {
    label: 'Dashboard',
    href: '/app/retail/dashboard',
    icon: LayoutDashboard,
    group: 'Core',
    match: (pathname) =>
      pathname === '/app/retail' || isExactOrChild(pathname, '/app/retail/dashboard'),
  },
  {
    label: 'Campaigns',
    href: '/app/retail/campaigns',
    icon: Megaphone,
    group: 'Core',
  },
  {
    label: 'Contacts',
    href: '/app/retail/contacts',
    icon: Users,
    group: 'Core',
  },
  {
    label: 'Templates',
    href: '/app/retail/templates',
    icon: FileText,
    group: 'Core',
  },
  {
    label: 'Automations',
    href: '/app/retail/automations',
    icon: Zap,
    group: 'Engage',
  },
  {
    label: 'NFC',
    href: '/app/retail/nfc',
    icon: RadioTower,
    group: 'Engage',
  },
  {
    label: 'Billing',
    href: '/app/retail/billing',
    icon: CreditCard,
    group: 'Revenue',
  },
  {
    label: 'Settings',
    href: '/app/retail/settings',
    icon: Settings,
    group: 'Settings',
  },
];
