/**
 * AuthLayout Component
 *
 * Layout for authentication pages (login, register)
 * Centered form with background
 */

import React from 'react';
import { Card } from 'antd';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
}

/**
 * Authentication layout wrapper
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title = 'MarketMonitor',
}) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 style={{ color: 'white', margin: '0' }}>
          {title}
        </h1>
      </div>

      <Card
        style={{
          width: '100%',
          maxWidth: '450px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {children}
      </Card>
    </div>
  );
};

export default AuthLayout;
