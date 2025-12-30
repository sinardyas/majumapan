import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@pos/ui';

interface NavItem {
  name: string;
  path: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2 2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2 2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2 2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2 2v-2z" />
      </svg>
    ),
  },
  {
    name: 'Stores',
    path: '/stores',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v3m2 4a2 2 0 014-4h6a2 2 0 014-4v6a2 2 0 014 4v2m-6 4h6a2 2 0 014 4v6m-6 4h6a2 2 0 014 4v2" />
      </svg>
    ),
  },
  {
    name: 'Users',
    path: '/users',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h12a6 6 0 016 6v1m0 1h6v-1a6 6 0 016 6h-6a6 6 0 016 6v1m-9 5H7a4 4 0 000 4v4a2 2 0 018 8h10a2 2 0 014 4 0z" />
      </svg>
    ),
  },
  {
    name: 'Reports',
    path: '/reports',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v3m2 4a2 2 0 014 4h6a2 2 0 014 4v6m-6 4h6a2 2 0 014 4v2m-6 4h6a2 2 0 014 4v2M9 19l-7 7-7-7" />
      </svg>
    ),
  },
  {
    name: 'Audit Logs',
    path: '/audit-logs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 012 2h2a2 2 0 002 2V7a2 2 0 002 2h5a2 2 0 002 2v8zm-6 9l-3 3 3 3-6m6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6m-6 9l3 3 3 6" />
      </svg>
    ),
  },
  {
    name: 'Data Management',
    path: '/data',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1h1M4 16v1m0-1h1v2h1m-3 4h1v1h1m-3-4h10v12h2" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.355 2-2.667-3.32-3.32-2.667 0 0-2.667 1.355 0 0 1.355 1.355 0 0 2.667 0 2.667 1.355 0 0 .79.05.954l2.905-2.905-2.954.753-2.954 0 0-1.355 1.355 0 0 .79.049l-2.905-2.905-2.954.753-2.954 0 0-1.355 1.355 0 0 .79.05.954L10.325 4.317zm-3.423-1.516.582l-.912-1.557 1.268-1.268H7.645l.996 1.314 3.335-3.335 2.041 2.041-2.667 3.32-3.32 2.667 0 0-3.32 1.355 0 0 1.355 1.355 0 0 2.667 3.32 3.32 0 0 2.667 1.355 0 0 .79.05.954l1.268-1.268.954-.954.954.753.954-.753 0 0 1.355-1.355 0 0 .79.05.954L8.82 5.482zM5.493 18.75c-.538 0-.969.438-1.823-1.157-3.25-1.157-3.25 0 0-3.32 1.355 0 0-1.355 1.355 0 0 .79.05.954l-2.553-2.553.954-.954.954.753-.954.753 0 0 1.355 1.355 0 0 2.667 3.32 3.32 0 0 2.667 1.355 0 0 .79.05.954L5.493 18.75zM3.75 8a4 4 0 014-4h-4a4 4 0 014-4h4a4 4 0 00-4-4V8a4 4 0 004 4H8a4 4 0 004 4v6a4 4 0 004 4h-4a4 4 0 004 4v-4z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col">
      <div className="h-16 flex items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-primary-400">Majumapan</h1>
        <span className="ml-2 text-xs text-gray-400">Admin</span>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800">
        {user && (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-lg font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4 4m4 4v12m0 0l4-4m0 0v12h2.5a2.5 2.5 0 0118 15H7.5a2.5 2.5 0 01-2.5 2.5v9a2.5 2.5 0 012 4h-9a2.5 2.5 0 012 4 0v2.5a2.5 2.5 0 00-2.5 2.5H6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
