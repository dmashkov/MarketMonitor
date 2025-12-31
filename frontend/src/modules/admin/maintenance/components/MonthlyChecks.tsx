/**
 * MonthlyChecks
 *
 * Ежемесячные проверки системы (30 минут)
 */

import React from 'react';
import { Card, Button, Space, Alert, Statistic, Row, Col, Table, Tag, Typography } from 'antd';
import {
  SyncOutlined,
  LineChartOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const { Title, Paragraph } = Typography;

interface MonthlyStats {
  total_runs: number;
  successful: number;
  failed: number;
  total_documents: number;
  success_rate: number;
  avg_duration_sec: number;
  total_sources_used: number;
  unique_segments: number;
}

interface DatabaseSize {
  table_name: string;
  row_count: number;
  total_size_mb: number;
}

/**
 * Компонент ежемесячных проверок
 */
export const MonthlyChecks: React.FC = () => {
  // Monthly stats
  const {
    data: monthlyStats,
    isLoading: loadingMonthlyStats,
    refetch: refetchMonthlyStats,
  } = useQuery({
    queryKey: ['maintenance-monthly-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_monthly_stats').single();

      if (error) throw error;
      return data as MonthlyStats;
    },
  });

  // Database size
  const {
    data: dbSize,
    isLoading: loadingDbSize,
    refetch: refetchDbSize,
  } = useQuery({
    queryKey: ['maintenance-db-size'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_database_size');

      if (error) throw error;
      return (data as DatabaseSize[]) || [];
    },
  });

  // Refresh all
  const handleRefreshAll = () => {
    refetchMonthlyStats();
    refetchDbSize();
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>Ежемесячные проверки (30 минут)</Title>
            <Paragraph type="secondary">
              Проверки, которые следует выполнять каждый месяц для долгосрочного анализа
            </Paragraph>
            <Button type="primary" icon={<SyncOutlined />} onClick={handleRefreshAll}>
              Обновить все проверки
            </Button>
          </Space>
        </Card>

        {/* Monthly Pipeline Statistics */}
        <Card
          title={
            <Space>
              <LineChartOutlined />
              <span>Статистика Pipeline за 30 дней</span>
            </Space>
          }
          loading={loadingMonthlyStats}
          extra={
            <Button size="small" onClick={() => refetchMonthlyStats()}>
              Проверить
            </Button>
          }
        >
          {monthlyStats ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Main Stats */}
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="Всего запусков"
                    value={monthlyStats.total_runs}
                    prefix={<LineChartOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Успешных"
                    value={monthlyStats.successful}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Ошибок"
                    value={monthlyStats.failed}
                    valueStyle={{ color: monthlyStats.failed > 0 ? '#ff4d4f' : undefined }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Success Rate"
                    value={monthlyStats.success_rate}
                    suffix="%"
                    valueStyle={{
                      color:
                        monthlyStats.success_rate >= 80
                          ? '#52c41a'
                          : monthlyStats.success_rate >= 50
                            ? '#faad14'
                            : '#ff4d4f',
                    }}
                  />
                </Col>
              </Row>

              {/* Secondary Stats */}
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="Всего документов"
                    value={monthlyStats.total_documents}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Среднее время"
                    value={monthlyStats.avg_duration_sec}
                    suffix="сек"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Источников использовано"
                    value={monthlyStats.total_sources_used}
                    prefix={<GlobalOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Уникальных сегментов"
                    value={monthlyStats.unique_segments}
                    prefix={<AppstoreOutlined />}
                  />
                </Col>
              </Row>

              {/* Long-term Analysis */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Paragraph>
                  <strong>Анализ за месяц:</strong>
                </Paragraph>

                {monthlyStats.total_documents < 100 && (
                  <Alert
                    message="Низкая продуктивность"
                    description={`За месяц создано всего ${monthlyStats.total_documents} документов. Для активного мониторинга рекомендуется > 200 документов/месяц.`}
                    type="warning"
                    showIcon
                  />
                )}

                {monthlyStats.unique_segments < 3 && (
                  <Alert
                    message="Низкое покрытие сегментов"
                    description={`Мониторинг охватывает только ${monthlyStats.unique_segments} сегментов. Рекомендуется расширить покрытие.`}
                    type="info"
                    showIcon
                  />
                )}

                {monthlyStats.total_sources_used < 5 && (
                  <Alert
                    message="Мало источников"
                    description={`Используется только ${monthlyStats.total_sources_used} источников. Для качественного мониторинга рекомендуется > 10 источников.`}
                    type="info"
                    showIcon
                  />
                )}

                {monthlyStats.success_rate >= 80 &&
                  monthlyStats.total_documents >= 100 &&
                  monthlyStats.unique_segments >= 3 && (
                    <Alert
                      message="Отличная работа системы"
                      description={`Система работает стабильно: ${monthlyStats.success_rate}% успеха, ${monthlyStats.total_documents} документов, ${monthlyStats.unique_segments} сегментов покрыто.`}
                      type="success"
                      showIcon
                    />
                  )}
              </Space>
            </Space>
          ) : (
            <Alert message="Статистика недоступна" type="info" />
          )}
        </Card>

        {/* Database Size */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>Размер базы данных</span>
            </Space>
          }
          loading={loadingDbSize}
          extra={
            <Button size="small" onClick={() => refetchDbSize()}>
              Проверить
            </Button>
          }
        >
          {dbSize && dbSize.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Table
                dataSource={dbSize}
                rowKey="table_name"
                pagination={false}
                columns={[
                  {
                    title: 'Таблица',
                    dataIndex: 'table_name',
                    key: 'table_name',
                    render: (name) => <Tag color="blue">{name}</Tag>,
                  },
                  {
                    title: 'Количество строк',
                    dataIndex: 'row_count',
                    key: 'row_count',
                    render: (count) => count.toLocaleString('ru-RU'),
                  },
                  {
                    title: 'Размер',
                    dataIndex: 'total_size_mb',
                    key: 'total_size_mb',
                    render: (size) => `${size} MB`,
                  },
                ]}
                summary={(pageData) => {
                  const totalSize = pageData.reduce((sum, item) => sum + item.total_size_mb, 0);
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <strong>Всего</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <strong>{totalSize.toFixed(2)} MB</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />

              {dbSize.length > 0 && (
                <Alert
                  message="Мониторинг размера БД"
                  description="Следите за ростом таблиц. Если общий размер превышает 1 GB, рекомендуется настроить архивирование старых данных."
                  type="info"
                  showIcon
                />
              )}
            </Space>
          ) : (
            <Alert message="Информация о размере БД недоступна" type="warning" />
          )}
        </Card>

        {/* Monthly Recommendations */}
        <Card title="Рекомендации по ежемесячному обслуживанию">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph>
              <strong>1. Долгосрочный анализ</strong>
              <ul>
                <li>Сравните метрики с предыдущим месяцем</li>
                <li>Выявите тренды роста/падения документов</li>
                <li>Оцените coverage сегментов и источников</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>2. Оптимизация</strong>
              <ul>
                <li>Удалите старые документы-дубликаты (если {'>'} 1000 дубликатов)</li>
                <li>Проверьте индексы на больших таблицах</li>
                <li>Оптимизируйте медленные запросы (если есть)</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>3. Расширение</strong>
              <ul>
                <li>Добавьте новые источники для слабо покрытых сегментов</li>
                <li>Обновите приоритеты источников на основе качества данных</li>
                <li>Рассмотрите расширение мониторинга на новые сегменты</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>4. Backup и безопасность</strong>
              <ul>
                <li>Убедитесь, что backup работает корректно</li>
                <li>Проверьте RLS политики</li>
                <li>Обновите пароли и ключи API (раз в 3 месяца)</li>
              </ul>
            </Paragraph>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default MonthlyChecks;
