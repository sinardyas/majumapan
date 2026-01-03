import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission, type UserRole } from '@pos/shared';
import { useSync } from '@/hooks/useSync';
import { RejectedTransactions } from '@/components/shared/RejectedTransactions';
import { db } from '@/db';
import {
  ShoppingCart,
  LayoutGrid,
  FileText,
  Package,
  Tags,
  Percent,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

const navItems: NavItem[] = [
  {
    name: 'POS',
    path: '/pos',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutGrid className="h-5 w-5" />,
  },
  {
    name: 'Transactions',
    path: '/transactions',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    name: 'Products',
    path: '/products',
    icon: <Package className="h-5 w-5" />,
    permission: 'products:read',
  },
  {
    name: 'Categories',
    path: '/categories',
    icon: <Tags className="h-5 w-5" />,
    permission: 'categories:create',
  },
  {
    name: 'Discounts',
    path: '/discounts',
    icon: <Percent className="h-5 w-5" />,
    permission: 'discounts:create',
  },
  {
    name: 'Sync Status',
    path: '/sync-status',
    icon: <RefreshCw className="h-5 w-5" />,
    permission: 'sync:status',
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    isSyncing,
    isOnline,
    pendingCount,
    hasRejectedTransactions,
    sync,
    canSync,
  } = useSync();
  const [showRejected, setShowRejected] = useState(false);
  const userRole = (user?.role || 'cashier') as UserRole;

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

  const filteredNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    return hasPermission(userRole, item.permission as Parameters<typeof hasPermission>[1]);
  });

  const handleLogout = async () => {
    logout();
    await db.delete();
    navigate('/login');
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full bg-gray-900 text-white flex flex-col transition-all duration-300 z-50 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className={`h-16 flex items-center justify-center border-b border-gray-800 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-primary-400">Majumapan</h1>
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
            {filteredNavItems.map((item) => (
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
        </nav>

        {!isCollapsed && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                <span className="text-sm text-gray-400">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <button
                onClick={() => sync()}
                disabled={!canSync}
                className="p-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Sync now"
              >
                <RefreshCw className={`h-4 w-4 text-gray-400 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full">
                  {pendingCount} pending
                </span>
              )}
              {hasRejectedTransactions && (
                <button
                  onClick={() => setShowRejected(true)}
                  className="px-2 py-0.5 bg-red-900/50 text-red-300 text-xs rounded-full hover:bg-red-800/50"
                >
                  View rejected
                </button>
              )}
            </div>
          </div>
        )}

        {user && (
          <div className={`p-4 border-t border-gray-800 ${isCollapsed ? 'px-2 py-4' : ''}`}>
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
          </div>
        )}
      </aside>

      <RejectedTransactions
        isOpen={showRejected}
        onClose={() => setShowRejected(false)}
      />
    </>
  );
}
