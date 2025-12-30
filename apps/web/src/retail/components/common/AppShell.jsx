import { useSelector } from 'react-redux';
import { Outlet, useLocation } from 'react-router-dom';
import SidebarNav from './SidebarNav';
import TopBar from './TopBar';
import BillingBanner from './BillingBanner';

// Route title mapping
const routeTitles = {
  '/retail/dashboard': { title: 'Dashboard', subtitle: 'Overview of your store performance' },
  '/retail/campaigns': { title: 'Campaigns', subtitle: 'Manage your SMS campaigns' },
  '/retail/contacts': { title: 'Contacts', subtitle: 'Manage your customer contacts' },
  '/retail/templates': { title: 'Templates', subtitle: 'Browse system templates and manage your custom templates' },
  '/retail/billing': { title: 'Billing', subtitle: 'Manage subscription and credits' },
  '/retail/automations': { title: 'Automations', subtitle: 'Welcome and birthday messages' },
  '/retail/settings': { title: 'Settings', subtitle: 'Account and preferences' },
};

export default function AppShell() {
  const location = useLocation();
  const { sidebarCollapsed } = useSelector((state) => state.ui);

  // Get title for current route
  const routeInfo = routeTitles[location.pathname] || { title: 'Astronote', subtitle: '' };

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarNav />
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <BillingBanner />
        <TopBar title={routeInfo.title} subtitle={routeInfo.subtitle} />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

