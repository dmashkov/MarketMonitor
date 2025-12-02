/**
 * Main Application Component
 *
 * Handles routing, authentication, and global state management
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// Import Supabase utilities
import { supabase, onAuthStateChanged } from './lib/supabase';

// Import types
import type { Session } from '@supabase/supabase-js';

// Import pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

// Layout components (to be created)
// import AppLayout from './components/layout/AppLayout';
// import AdminLayout from './components/layout/AdminLayout';
// import UserLayout from './components/layout/UserLayout';

// Page components (to be created)
// import DashboardPage from './pages/DashboardPage';
// import EventsPage from './pages/EventsPage';
// import ReportsPage from './pages/ReportsPage';
// import UsersPage from './pages/admin/UsersPage';
// import PromptsPage from './pages/admin/PromptsPage';
// import SchedulerPage from './pages/admin/SchedulerPage';

// Initialize React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Protected Route Component
 * Ensures only authenticated users can access the route
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Admin Route Component
 * Ensures only admin users can access the route
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      const session = await supabase.auth.getSession();

      if (!session.data.session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.data.session.user.id)
        .single();

      if (error) {
        console.error('Failed to fetch user role:', error);
        setLoading(false);
        return;
      }

      setRole(data?.role);
      setLoading(false);
    };

    checkAdminRole();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

/**
 * Main App Component
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Dashboard & Main Routes */}
          {/* <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <EventsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          /> */}

          {/* Admin Routes */}
          {/* <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout>
                    <UsersPage />
                  </AdminLayout>
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/prompts"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout>
                    <PromptsPage />
                  </AdminLayout>
                </AdminRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/scheduler"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout>
                    <SchedulerPage />
                  </AdminLayout>
                </AdminRoute>
              </ProtectedRoute>
            }
          /> */}

          {/* Error Routes */}
          <Route
            path="/unauthorized"
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h1 className="text-4xl font-bold mb-4">403 - Доступ запрещен</h1>
                  <p className="text-gray-600 mb-6">
                    У вас нет прав доступа к этому разделу
                  </p>
                  <a href="/" className="text-blue-600 hover:underline">
                    Вернуться на главную
                  </a>
                </div>
              </div>
            }
          />

          {/* 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
