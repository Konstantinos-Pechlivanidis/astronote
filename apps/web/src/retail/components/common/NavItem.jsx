import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

export default function NavItem({ to, icon: Icon, label, collapsed = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100',
        )
      }
      title={collapsed ? label : undefined}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

