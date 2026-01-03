import { type ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from '../ErrorBoundary';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    return window.matchMedia('(max-width: 1279px)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1279px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsCollapsed(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      <div
        className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 ${
          isCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-auto">
          <ErrorBoundary
            fallback={
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Page Error</h2>
                <p className="text-gray-500">This page encountered an error. Please try again.</p>
              </div>
            }
          >
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
