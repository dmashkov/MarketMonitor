/**
 * RegisterForm Component
 *
 * Form for user registration
 * Type-safe with validation
 */

import React, { useState } from 'react';
import { Form, Input, Button, Alert, Spin, Checkbox } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import type { RegisterFormData } from '@/shared/types';

interface RegisterFormProps {
  onSuccess?: () => void;
}

interface FormValues {
  email: string;
  password: string;
  passwordConfirm: string;
  fullName?: string;
  agreeTerms?: boolean;
}

/**
 * Register form component with validation and error handling
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate password match
   */
  const validatePasswordMatch = (_: unknown, value: string): Promise<void> => {
    if (!value || form.getFieldValue('password') === value) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('Пароли не совпадают'));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (values: FormValues): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Validate agree terms
      if (!values.agreeTerms) {
        setError('Необходимо согласиться с условиями использования');
        return;
      }

      const registerData: RegisterFormData = {
        email: values.email,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        fullName: values.fullName,
      };

      await register(
        registerData.email,
        registerData.password,
        registerData.fullName
      );

      // Success - show message and redirect
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/login', {
          state: { message: 'Регистрация успешна! Пожалуйста, авторизуйтесь.' },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2>Регистрация</h2>

      {error && (
        <Alert
          message="Ошибка регистрации"
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
            label="Полное имя"
            name="fullName"
            rules={[
              { required: true, message: 'Полное имя обязательно' },
              { min: 2, message: 'Полное имя должно быть не менее 2 символов' },
            ]}
          >
            <Input
              placeholder="Иван Иванов"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: 'Пароль обязателен' },
              { min: 8, message: 'Пароль должен быть не менее 8 символов' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Пароль должен содержать заглавные и строчные буквы и цифры',
              },
            ]}
          >
            <Input.Password
              placeholder="••••••••"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            label="Подтверждение пароля"
            name="passwordConfirm"
            rules={[
              { required: true, message: 'Подтверждение пароля обязательно' },
              { validator: validatePasswordMatch },
            ]}
          >
            <Input.Password
              placeholder="••••••••"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="agreeTerms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) => {
                  if (value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(''));
                },
              },
            ]}
          >
            <Checkbox>
              Я согласен с{' '}
              <a href="#" onClick={(e) => e.preventDefault()}>
                условиями использования
              </a>
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={loading}
            >
              Зарегистрироваться
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <p>
              Уже есть аккаунт?{' '}
              <a href="/login" onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}>
                Войти
              </a>
            </p>
          </div>
        </Form>
      </Spin>
    </div>
  );
};

export default RegisterForm;
