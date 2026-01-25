import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  LayoutGrid,
  Package,
  Building,
  Users,
  FileText,
  ClipboardList,
  Database,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  History,
  Monitor,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: <LayoutGrid className="h-5 w-5" />,
  },
  {
    name: 'Products',
    path: '/products',
    icon: <Package className="h-5 w-5" />,
  },
  {
    name: 'Stores',
    path: '/stores',
    icon: <Building className="h-5 w-5" />,
  },
  {
    name: 'Users',
    path: '/users',
    icon: <Users className="h-5 w-5" />,
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    name: 'Audit Logs',
    path: '/audit-logs',
    icon: <ClipboardList className="h-5 w-5" />,
  },
  {
    name: 'Data Management',
    path: '/data',
    icon: <Database className="h-5 w-5" />,
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

const eodNavItems: NavItem[] = [
  {
    name: 'EOD Settings',
    path: '/eod/settings',
    icon: <CalendarCheck className="h-5 w-5" />,
  },
  {
    name: 'Master Terminals',
    path: '/eod/master-terminals',
    icon: <Monitor className="h-5 w-5" />,
  },
  {
    name: 'Day Close History',
    path: '/eod/day-close-history',
    icon: <History className="h-5 w-5" />,
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 text-white flex flex-col transition-all duration-300 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`h-16 flex items-center justify-center border-b border-gray-800 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {!isCollapsed && (
          <>
            <h1 className="text-xl font-bold text-primary-400">Majumapan</h1>
            <span className="ml-2 text-xs text-gray-400">Admin</span>
          </>
        )}
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ${
            isCollapsed ? 'absolute right-0 translate-x-1/2 top-8 bg-gray-900' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className={`${isCollapsed ? 'px-2' : 'px-3'} space-y-1`}>
          {navItems.map((item) => (
            <li key={item.path} className="w-full">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  } ${isCollapsed ? 'group relative' : ''}`
                }
                title={isCollapsed ? item.name : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.name}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {!isCollapsed && (
          <div className="px-4 py-2">
            <div className="h-px bg-gray-700"></div>
          </div>
        )}

        <div className={`${isCollapsed ? 'px-2' : 'px-3'} space-y-1`}>
          {!isCollapsed && (
            <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              End of Day
            </p>
          )}
          {eodNavItems.map((item) => (
            <li key={item.path} className="w-full">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  } ${isCollapsed ? 'group relative' : ''}`
                }
                title={isCollapsed ? item.name : undefined}
              >
                {item.icon}
                {!isCollapsed && <span>{item.name}</span>}
                {isCollapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.name}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </div>
      </nav>

      <div className={`p-4 border-t border-gray-800 ${isCollapsed ? 'px-2 py-4' : ''}`}>
        {user && (
          <div className={`flex ${isCollapsed ? 'flex-col items-center gap-3' : 'items-center gap-3'}`}>
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white ${
                isCollapsed ? 'w-full' : ''
              }`}
              title={isCollapsed ? 'Logout' : undefined}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
