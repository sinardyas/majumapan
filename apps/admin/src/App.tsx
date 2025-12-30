import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ToastProvider } from '@pos/ui';
import { AdminLayout } from '@/components/layout/AdminLayout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Stores from '@/pages/Stores';
import Users from '@/pages/Users';
import Reports from '@/pages/Reports';
import AuditLogs from '@/pages/AuditLogs';
// import DataManagement from '@/pages/DataManagement';
import Settings from '@/pages/Settings';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <ToastProvider>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Stores />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Users />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Reports />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <AuditLogs />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* <Route
          path="/data"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <DataManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        /> */}

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Settings />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
