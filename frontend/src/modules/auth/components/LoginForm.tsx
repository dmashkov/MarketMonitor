/**
 * LoginForm Component
 *
 * Form for user authentication
 * Type-safe with zod validation
 */

import React, { useState } from 'react';
import { Form, Input, Button, Alert, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import type { LoginFormData } from '@/shared/types';

interface LoginFormProps {
  onSuccess?: () => void;
}

/**
 * Login form component with validation and error handling
 */
export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (values: LoginFormData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await login(values.email, values.password);

      // Success - redirect to dashboard
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to login';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2>Вход в систему</h2>

      {error && (
        <Alert
          message="Ошибка входа"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: '20px' }}
        />
      )}

      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email обязателен' },
              { type: 'email', message: 'Некорректный email' },
            ]}
          >
            <Input
              type="email"
              placeholder="your@email.com"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: 'Пароль обязателен' },
              { min: 6, message: 'Пароль должен быть не менее 6 символов' },
            ]}
          >
            <Input.Password
              placeholder="••••••••"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={loading}
            >
              Войти
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <p>
              Нет аккаунта?{' '}
              <a href="/register" onClick={(e) => {
                e.preventDefault();
                navigate('/register');
              }}>
                Зарегистрироваться
              </a>
            </p>
          </div>
        </Form>
      </Spin>
    </div>
  );
};

export default LoginForm;
