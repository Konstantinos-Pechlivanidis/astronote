import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Megaphone, Users, FileText, CreditCard, Settings, Zap } from 'lucide-react';
import { toggleSidebar, toggleMobileDrawer, closeMobileDrawer } from '@/store/uiSlice';
import NavItem from './NavItem';

const navigation = [
  { to: '/retail/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/retail/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/retail/contacts', icon: Users, label: 'Contacts' },
  { to: '/retail/templates', icon: FileText, label: 'Templates' },
  { to: '/retail/billing', icon: CreditCard, label: 'Billing' },
  { to: '/retail/automations', icon: Zap, label: 'Automations' },
  { to: '/retail/settings', icon: Settings, label: 'Settings' },
];

export default function SidebarNav() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { sidebarCollapsed, mobileDrawerOpen } = useSelector((state) => state.ui);

  const handleToggle = () => {
    dispatch(toggleSidebar());
  };

  const handleMobileToggle = () => {
    dispatch(toggleMobileDrawer());
  };

  const handleCloseMobile = () => {
    dispatch(closeMobileDrawer());
  };

  // Close mobile drawer when route changes
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      dispatch(closeMobileDrawer());
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={handleMobileToggle}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md text-gray-600 hover:bg-gray-100"
        aria-label="Toggle menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={handleCloseMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40
          transition-transform duration-300 ease-in-out
          ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">Astronote</h1>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className="hidden lg:block p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
              <button
                onClick={handleCloseMobile}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1" onClick={handleNavClick}>
            {navigation.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}

