import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@pos/ui';

// Pages
import Login from '@/pages/Login';
import POS from '@/pages/POS';
import CustomerDisplay from '@/pages/CustomerDisplay';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Products from '@/pages/Products';
import Categories from '@/pages/Categories';
import Discounts from '@/pages/Discounts';
import SyncStatus from '@/pages/SyncStatus';
import PendingCarts from '@/pages/PendingCarts';
import EndOfDay from '@/pages/EndOfDay';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Manager-only route wrapper
function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'manager' && user?.role !== 'admin') {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

// Layout for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner />
      <Sidebar isCollapsed={isCollapsed} onToggle={handleToggle} />
      <main className={`min-h-screen transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ToastProvider>
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/pos" replace /> : <Login />
        }
      />

      {/* Protected routes */}
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <POS />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/customer-display"
        element={
          <ProtectedRoute>
            <CustomerDisplay />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Dashboard />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Transactions />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Products />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/categories"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Categories />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/discounts"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Discounts />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      {/* Manager-only routes */}
      <Route
        path="/sync-status"
        element={
          <ManagerRoute>
            <AuthenticatedLayout>
              <SyncStatus />
            </AuthenticatedLayout>
          </ManagerRoute>
        }
      />

      <Route
        path="/pending-carts"
        element={
          <ManagerRoute>
            <AuthenticatedLayout>
              <PendingCarts />
            </AuthenticatedLayout>
          </ManagerRoute>
        }
      />

      <Route
        path="/end-of-day"
        element={
          <ManagerRoute>
            <AuthenticatedLayout>
              <EndOfDay />
            </AuthenticatedLayout>
          </ManagerRoute>
        }
      />

      {/* Redirect root to POS or login */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/pos' : '/login'} replace />}
      />

      {/* 404 - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ToastProvider>
  );
}
