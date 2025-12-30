import { useSelector } from 'react-redux';
import UserMenu from './UserMenu';

export default function TopBar({ title, subtitle, actions }) {
  const { sidebarCollapsed } = useSelector((state) => state.ui);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className={`flex items-center justify-between px-4 lg:px-6 py-4 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {actions}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

