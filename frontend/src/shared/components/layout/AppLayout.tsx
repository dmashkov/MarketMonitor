/**
 * AppLayout
 *
 * Основной макет приложения для аутентифицированных пользователей
 * Содержит навигацию, шапку и основной контент
 */

import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button, Drawer } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../../modules/auth/hooks/useAuth';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Компонент AppLayout
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Ошибка выхода:', error);
    }
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'Профиль',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Выход',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  const mainMenuItems: MenuProps['items'] = [
    {
      key: '/',
      label: 'Дашборд',
      onClick: () => navigate('/'),
    },
    {
      key: '/events',
      label: 'События',
      onClick: () => navigate('/events'),
    },
    {
      key: '/reports',
      label: 'Отчеты',
      onClick: () => navigate('/reports'),
    },
    ...(isAdmin
      ? [
          {
            type: 'divider' as const,
          },
          {
            key: '/admin',
            label: '⚙️ Администрирование',
            onClick: () => navigate('/admin'),
          },
        ]
      : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Сайдбар (скрыт на мобильных устройствах) */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="hidden md:block"
        breakpoint="md"
        collapsedWidth={0}
      >
        <div
          style={{
            height: '32px',
            margin: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {!collapsed && 'MarketMonitor'}
        </div>
        <Menu theme="dark" mode="inline" items={mainMenuItems} />
      </Sider>

      {/* Мобильное меню */}
      <Drawer
        title="Меню"
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        className="md:hidden"
      >
        <Menu mode="vertical" items={mainMenuItems} onClick={() => setMobileDrawerOpen(false)} />
      </Drawer>

      {/* Основной контент */}
      <Layout>
        {/* Шапка */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block"
            />
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden"
            />
            <h1 style={{ margin: 0, fontSize: '18px' }}>MarketMonitor</h1>
          </div>

          <Dropdown menu={{ items: userMenu }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar icon={<UserOutlined />} />
              <span className="hidden sm:inline">{user?.full_name || 'Пользователь'}</span>
            </div>
          </Dropdown>
        </Header>

        {/* Контент */}
        <Content style={{ background: '#f5f5f5', minHeight: '100vh' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
