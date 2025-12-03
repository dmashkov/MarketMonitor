/**
 * Main Application Component
 *
 * Обработка маршрутизации, аутентификации и глобального управления состоянием
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Импорт компонентов аутентификации
import { LoginPage, RegisterPage, ProtectedRoute } from './modules/auth';
import NotFoundPage from './pages/NotFoundPage';

// Импорт компонентов макета
import AppLayout from './shared/components/layout/AppLayout';

// Импорт страниц
import DashboardPage from './modules/dashboard/pages/DashboardPage';
// import EventsPage from './modules/events/pages/EventsPage';
// import ReportsPage from './modules/export/pages/ReportsPage';

// Инициализация React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 минут
    },
    mutations: {
      retry: 1,
    },
  },
});


/**
 * Основной компонент приложения
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Публичные маршруты */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Основные защищенные маршруты */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* <Route
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

          {/* Маршруты администратора */}
          {/* <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <UsersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/prompts"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PromptsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/scheduler"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SchedulerPage />
                </AppLayout>
              </ProtectedRoute>
            }
          /> */}

          {/* Маршруты ошибок */}
          <Route
            path="/unauthorized"
            element={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                  <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px' }}>
                    403 - Доступ запрещен
                  </h1>
                  <p style={{ color: '#666', marginBottom: '24px' }}>
                    У вас нет прав доступа к этому разделу
                  </p>
                  <a href="/" style={{ color: '#1890ff', textDecoration: 'underline' }}>
                    Вернуться на главную
                  </a>
                </div>
              </div>
            }
          />

          {/* 404 маршрут */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
