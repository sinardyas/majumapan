import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ToastProvider } from '@pos/ui';
import { AdminLayout } from '@/components/layout/AdminLayout';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Products = lazy(() => import('@/pages/Products'));
const Stores = lazy(() => import('@/pages/Stores'));
const Users = lazy(() => import('@/pages/Users'));
const Reports = lazy(() => import('@/pages/Reports'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Settings = lazy(() => import('@/pages/Settings'));
const DataManagement = lazy(() => import('@/pages/DataManagement'));
const MasterTerminals = lazy(() => import('@/pages/MasterTerminals'));
const DayCloseHistory = lazy(() => import('@/pages/DayCloseHistory'));
const DayCloseDetail = lazy(() => import('@/pages/DayCloseDetail'));


function Loading({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>{children}</Suspense>;
}

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
            isAuthenticated ? <Navigate to="/" replace /> : <Loading><Login /></Loading>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Dashboard /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Products /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Stores /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Users /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Reports /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><AuditLogs /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/data"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><DataManagement /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><Settings /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/eod/master-terminals"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><MasterTerminals /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/eod/day-close-history"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><DayCloseHistory /></AdminLayout></Loading>
            </ProtectedRoute>
          }
        />

        <Route
          path="/eod/day-close/:id"
          element={
            <ProtectedRoute>
              <Loading><AdminLayout><DayCloseDetail /></AdminLayout></Loading>
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
