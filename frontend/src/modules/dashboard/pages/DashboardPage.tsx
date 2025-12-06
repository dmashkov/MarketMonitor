/**
 * DashboardPage
 *
 * Главная страница приложения для аутентифицированных пользователей
 */

import React, { useState, useEffect } from 'react';
import { Layout, Card, Statistic, Row, Col, Spin, Empty } from 'antd';
import { AreaChartOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import useAuth from '../../auth/hooks/useAuth';

const { Content } = Layout;

/**
 * Компонент Dashboard
 */
export const DashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState({
    totalEvents: 0,
    processedToday: 0,
    schedules: 0,
  });

  useEffect(() => {
    // TODO: Загрузить статистику с сервера
    setStats({
      totalEvents: 42,
      processedToday: 12,
      schedules: 5,
    });
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Content style={{ padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '32px' }}>Добро пожаловать, {user?.full_name || 'Пользователь'}!</h1>

        {/* Статистика */}
        <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Всего событий"
                value={stats.totalEvents}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Обработано сегодня"
                value={stats.processedToday}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Активные расписания"
                value={stats.schedules}
                prefix={<AreaChartOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Основной контент */}
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card title="Последние события" bordered={false}>
              <Empty description="События будут доступны после первого запуска" />
            </Card>
          </Col>
        </Row>
      </div>
    </Content>
  );
};

export default DashboardPage;
