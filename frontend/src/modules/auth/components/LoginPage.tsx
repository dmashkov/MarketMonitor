/**
 * LoginPage
 *
 * Authentication page for user login
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert } from 'antd';
import LoginForm from './LoginForm';
import AuthLayout from './AuthLayout';

interface LocationState {
  message?: string;
  from?: { pathname: string };
}

/**
 * Login page component
 */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const handleSuccess = (): void => {
    // Redirect to intended page or dashboard
    const from = state?.from?.pathname || '/dashboard';
    navigate(from);
  };

  return (
    <AuthLayout title="MarketMonitor">
      {state?.message && (
        <Alert
          message={state.message}
          type="success"
          showIcon
          closable
          style={{ marginBottom: '20px' }}
        />
      )}
      <LoginForm onSuccess={handleSuccess} />
    </AuthLayout>
  );
};

export default LoginPage;
