import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from '../ErrorBoundary';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64 flex-1 overflow-hidden flex flex-col">
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
