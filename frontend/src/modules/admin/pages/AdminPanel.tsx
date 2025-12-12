/**
 * AdminPanel
 *
 * Страница администрирования приложения
 * Заглушка для Phase 3
 */

import React from 'react';
import { Card, Empty, Tag, Tabs, Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import useAuth from '../../../modules/auth/hooks/useAuth';
import { BrandsManager } from '../brands';
import { DocumentsLibrary } from '../documents';
import { SourcesManager } from '../sources';
import { UsersManager } from '../users';

/**
 * Компонент админ-панели
 */
export const AdminPanel: React.FC = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Доступ запрещен"
          description="Только администраторы могут получить доступ к этой странице"
          type="error"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: '24px' }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
        <h1>Администрирование</h1>

        <Tabs
          defaultActiveKey="brands"
          items={[
            {
              key: 'brands',
              label: '🏷️ Бренды',
              children: <BrandsManager />,
            },
            {
              key: 'documents',
              label: '📄 Документы',
              children: <DocumentsLibrary />,
            },
            {
              key: 'sources',
              label: '📰 Источники',
              children: <SourcesManager />,
            },
            {
              key: 'users',
              label: '👥 Пользователи',
              children: <UsersManager />,
            },
            {
              key: 'prompts',
              label: '📝 Промпты',
              children: (
                <Card style={{ marginTop: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Empty
                      description={
                        <div>
                          <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            📝 Библиотека промптов
                          </p>
                          <p style={{ color: '#666' }}>
                            Функционал будет реализован в Phase 3
                          </p>
                        </div>
                      }
                    />
                    <div style={{ marginTop: '24px' }}>
                      <Tag color="blue">Phase 3</Tag>
                      <p style={{ color: '#999', fontSize: '12px', marginTop: '12px' }}>
                        Будет включено: CRUD промптов, редактор, тестирование
                      </p>
                    </div>
                  </div>
                </Card>
              ),
            },
            {
              key: 'scheduler',
              label: '⏱️ Расписание',
              children: (
                <Card style={{ marginTop: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Empty
                      description={
                        <div>
                          <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                            ⏱️ Планировщик задач
                          </p>
                          <p style={{ color: '#666' }}>
                            Функционал будет реализован в Phase 3
                          </p>
                        </div>
                      }
                    />
                    <div style={{ marginTop: '24px' }}>
                      <Tag color="blue">Phase 3</Tag>
                      <p style={{ color: '#999', fontSize: '12px', marginTop: '12px' }}>
                        Будет включено: управление расписаниями, CRON выражения, логи
                      </p>
                    </div>
                  </div>
                </Card>
              ),
            },
          ]}
        />
      </div>
  );
};

export default AdminPanel;
