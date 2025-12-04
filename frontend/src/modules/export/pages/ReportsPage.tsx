/**
 * ReportsPage
 *
 * Страница генерации отчетов и экспорта данных
 * Заглушка для Phase 3
 */

import React from 'react';
import { Card, Empty, Tag, Button, Space } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import AppLayout from '../../../shared/components/layout/AppLayout';

/**
 * Компонент страницы отчетов
 */
export const ReportsPage: React.FC = () => {
  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Отчеты</h1>
          <Space>
            <Button icon={<DownloadOutlined />} disabled>
              CSV
            </Button>
            <Button icon={<FileExcelOutlined />} disabled>
              Excel
            </Button>
          </Space>
        </div>

        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Empty
              description={
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                    📊 Функционал в разработке
                  </p>
                  <p style={{ color: '#666' }}>
                    Страница отчетов будет реализована в Phase 3
                  </p>
                </div>
              }
            />
            <div style={{ marginTop: '24px' }}>
              <Tag color="blue">Phase 3</Tag>
              <p style={{ color: '#999', fontSize: '12px', marginTop: '12px' }}>
                Будет включено: выбор периода, экспорт CSV/Excel, AI анализ
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
