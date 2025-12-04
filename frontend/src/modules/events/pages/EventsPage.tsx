/**
 * EventsPage
 *
 * Страница со списком всех событий рынка
 * Заглушка для Phase 3
 */

import React from 'react';
import { Card, Empty, Tag, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import AppLayout from '../../../shared/components/layout/AppLayout';

/**
 * Компонент страницы событий
 */
export const EventsPage: React.FC = () => {
  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>События</h1>
          <Button type="primary" icon={<PlusOutlined />}>
            Новое событие
          </Button>
        </div>

        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Empty
              description={
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    📋 Функционал в разработке
                  </p>
                  <p style={{ color: '#666' }}>
                    Страница событий будет реализована в Phase 3
                  </p>
                </div>
              }
            />
            <div style={{ marginTop: '24px' }}>
              <Tag color="blue">Phase 3</Tag>
              <p style={{ color: '#999', fontSize: '12px', marginTop: '12px' }}>
                Будет включено: таблица событий, фильтры, поиск, экспорт
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default EventsPage;
