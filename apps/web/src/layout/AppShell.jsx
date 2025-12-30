import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toggleSidebar } from '@/store/uiSlice';
import { clearRetailToken, clearShopifyToken } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  List,
  Zap,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

// Navigation configs for each area
const retailNavigation = [
  { name: 'Dashboard', href: '/retail/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/retail/campaigns', icon: Megaphone },
  { name: 'Contacts', href: '/retail/contacts', icon: Users },
  { name: 'Lists', href: '/retail/lists', icon: List },
  { name: 'Automations', href: '/retail/automations', icon: Zap },
  { name: 'Templates', href: '/retail/templates', icon: FileText },
  { name: 'Settings', href: '/retail/settings', icon: Settings },
];

const shopifyNavigation = [
  { name: 'Dashboard', href: '/shopify/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/shopify/campaigns', icon: Megaphone },
  { name: 'Contacts', href: '/shopify/contacts', icon: Users },
  { name: 'Lists', href: '/shopify/lists', icon: List },
  { name: 'Automations', href: '/shopify/automations', icon: Zap },
  { name: 'Templates', href: '/shopify/templates', icon: FileText },
  { name: 'Settings', href: '/shopify/settings', icon: Settings },
];

export default function AppShell() {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);

  // Determine which area we're in
  const isRetail = location.pathname.startsWith('/retail');
  const isShopify = location.pathname.startsWith('/shopify');
  const area = isRetail ? 'retail' : isShopify ? 'shopify' : null;
  const navigation = isRetail ? retailNavigation : shopifyNavigation;
  const areaName = isRetail ? 'Retail' : 'Shopify';

  const handleLogout = () => {
    if (isRetail) {
      dispatch(clearRetailToken());
      navigate('/retail/login');
    } else if (isShopify) {
      dispatch(clearShopifyToken());
      navigate('/shopify/login');
    }
  };

  if (!area) {
    // Not in a protected area, just render outlet (for marketing pages)
    return <Outlet />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 bg-white border-r border-gray-200 overflow-hidden`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Astronote</h1>
              <p className="text-xs text-gray-500">{areaName}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleSidebar())}
              className="md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleSidebar())}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1" />
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
              Back to Home
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

