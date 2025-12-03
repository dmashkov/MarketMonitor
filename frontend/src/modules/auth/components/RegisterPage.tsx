/**
 * RegisterPage
 *
 * Authentication page for user registration
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterForm from './RegisterForm';
import AuthLayout from './AuthLayout';

/**
 * Register page component
 */
export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = (): void => {
    navigate('/login', {
      state: {
        message: 'Регистрация успешна! Пожалуйста, авторизуйтесь.',
      },
    });
  };

  return (
    <AuthLayout title="MarketMonitor - Регистрация">
      <RegisterForm onSuccess={handleSuccess} />
    </AuthLayout>
  );
};

export default RegisterPage;
