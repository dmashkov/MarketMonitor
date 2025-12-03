/**
 * ProtectedRoute Component
 *
 * Wraps routes that require authentication
 * Redirects to login if not authenticated
 * Optionally checks for specific role (admin)
 *
 * Type-safe and modular
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import useAuth from '../hooks/useAuth';

interface ProtectedRouteProps {
  /** Route component */
  children: React.ReactNode;
  /** Optional role requirement ('admin' or 'user') */
  requiredRole?: 'admin' | 'user';
}

/**
 * Protected route component
 *
 * @param children - Component to render if authorized
 * @param requiredRole - Optional role requirement
 * @returns Protected route or redirect
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { session, user, isLoading, isAdmin, isActive } = useAuth();
  const location = useLocation();

  // Show loading while fetching auth status
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Загрузка..." />
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is not active - show message
  if (!isActive) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Аккаунт деактивирован</h2>
        <p>Пожалуйста, свяжитесь с администратором</p>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Доступ запрещен</h2>
        <p>Для этого требуются права администратора</p>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default ProtectedRoute;
