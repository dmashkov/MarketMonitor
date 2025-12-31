/**
 * MaintenanceGuide
 *
 * Интерактивное руководство по обслуживанию системы
 * Интеграция MAINTENANCE_GUIDE.md в UI приложения
 */

import React from 'react';
import { Tabs, Card, Typography } from 'antd';
import { ToolOutlined, CalendarOutlined, LineChartOutlined, BugOutlined } from '@ant-design/icons';
import { DailyChecks } from '../components/DailyChecks';
import { WeeklyChecks } from '../components/WeeklyChecks';
import { MonthlyChecks } from '../components/MonthlyChecks';
import { TroubleshootingGuide } from '../components/TroubleshootingGuide';

const { Title, Paragraph } = Typography;

/**
 * Компонент руководства по обслуживанию
 */
export const MaintenanceGuide: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>
          <ToolOutlined /> Руководство по обслуживанию системы
        </Title>
        <Paragraph type="secondary">
          Интерактивные проверки и диагностика системы MarketMonitor
        </Paragraph>

        <Tabs
          defaultActiveKey="daily"
          items={[
            {
              key: 'daily',
              label: (
                <span>
                  <CalendarOutlined /> Daily Checks (5 мин)
                </span>
              ),
              children: <DailyChecks />,
            },
            {
              key: 'weekly',
              label: (
                <span>
                  <LineChartOutlined /> Weekly Checks (15 мин)
                </span>
              ),
              children: <WeeklyChecks />,
            },
            {
              key: 'monthly',
              label: (
                <span>
                  <LineChartOutlined /> Monthly Checks (30 мин)
                </span>
              ),
              children: <MonthlyChecks />,
            },
            {
              key: 'troubleshooting',
              label: (
                <span>
                  <BugOutlined /> Troubleshooting
                </span>
              ),
              children: <TroubleshootingGuide />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default MaintenanceGuide;
