import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';

// Pages
import Login from '@/pages/Login';
import POS from '@/pages/POS';
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Products from '@/pages/Products';
import Categories from '@/pages/Categories';
import Users from '@/pages/Users';
import Discounts from '@/pages/Discounts';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Layout for authenticated pages
function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <OfflineBanner />
      <Sidebar />
      <main className="ml-64 min-h-screen">
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
        path="/users"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <Users />
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
