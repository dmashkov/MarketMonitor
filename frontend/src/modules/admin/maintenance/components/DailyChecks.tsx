/**
 * DailyChecks
 *
 * Ежедневные проверки системы (5 минут)
 */

import React from 'react';
import { Card, Button, Space, Alert, Statistic, Row, Col, Table, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const { Title, Paragraph, Text } = Typography;

interface PipelineRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  documents_created: number;
  execution_time_ms: number | null;
  error_message: string | null;
}

interface StuckRun {
  id: string;
  status: string;
  started_at: string;
  duration_minutes: number;
}

interface CronJob {
  jobname: string;
  active: boolean;
  schedule: string;
}

/**
 * Компонент ежедневных проверок
 */
export const DailyChecks: React.FC = () => {
  // 1. Последний запуск pipeline
  const {
    data: lastRun,
    isLoading: loadingLastRun,
    refetch: refetchLastRun,
  } = useQuery({
    queryKey: ['maintenance-last-run'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data as PipelineRun;
    },
  });

  // 2. Зависшие задачи
  const {
    data: stuckRuns,
    isLoading: loadingStuckRuns,
    refetch: refetchStuckRuns,
  } = useQuery({
    queryKey: ['maintenance-stuck-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_stuck_runs');

      if (error) throw error;
      return (data as StuckRun[]) || [];
    },
  });

  // 3. pg_cron jobs
  const {
    data: cronJobs,
    isLoading: loadingCronJobs,
    refetch: refetchCronJobs,
  } = useQuery({
    queryKey: ['maintenance-cron-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_pg_cron_jobs');

      if (error) throw error;
      return (data as CronJob[]) || [];
    },
  });

  // 4. Документы за 24 часа
  const {
    data: recentDocs,
    isLoading: loadingRecentDocs,
    refetch: refetchRecentDocs,
  } = useQuery({
    queryKey: ['maintenance-recent-docs'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      return count || 0;
    },
  });

  // Refresh all checks
  const handleRefreshAll = () => {
    refetchLastRun();
    refetchStuckRuns();
    refetchCronJobs();
    refetchRecentDocs();
  };

  // Status helpers
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'processing';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>Ежедневные проверки (5 минут)</Title>
            <Paragraph type="secondary">
              Проверки, которые следует выполнять каждый день для контроля работы системы
            </Paragraph>
            <Button type="primary" icon={<SyncOutlined />} onClick={handleRefreshAll}>
              Обновить все проверки
            </Button>
          </Space>
        </Card>

        {/* Check 1: Last Pipeline Run */}
        <Card
          title={
            <Space>
              <ApiOutlined />
              <span>1. Последний запуск Pipeline</span>
            </Space>
          }
          loading={loadingLastRun}
          extra={
            <Button size="small" onClick={() => refetchLastRun()}>
              Проверить
            </Button>
          }
        >
          {lastRun ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Статус"
                    value={lastRun.status}
                    prefix={getStatusIcon(lastRun.status)}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="Документов создано" value={lastRun.documents_created} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Время выполнения"
                    value={lastRun.execution_time_ms ? (lastRun.execution_time_ms / 1000).toFixed(1) : 'N/A'}
                    suffix="сек"
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Запущен"
                    value={new Date(lastRun.started_at).toLocaleString('ru-RU')}
                    valueStyle={{ fontSize: '14px' }}
                  />
                </Col>
              </Row>

              {lastRun.error_message && (
                <Alert
                  message="Ошибка выполнения"
                  description={lastRun.error_message}
                  type="error"
                  showIcon
                />
              )}

              {lastRun.status === 'completed' && lastRun.documents_created === 0 && (
                <Alert
                  message="Внимание"
                  description="Pipeline завершился успешно, но не создал ни одного документа. Проверьте качество источников."
                  type="warning"
                  showIcon
                />
              )}

              {lastRun.status === 'completed' && lastRun.documents_created > 0 && (
                <Alert
                  message="Всё в порядке"
                  description={`Pipeline работает корректно. Создано ${lastRun.documents_created} документов.`}
                  type="success"
                  showIcon
                />
              )}
            </Space>
          ) : (
            <Alert message="Запусков pipeline не найдено" type="info" />
          )}
        </Card>

        {/* Check 2: Stuck Runs */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined />
              <span>2. Зависшие задачи (stuck runs)</span>
            </Space>
          }
          loading={loadingStuckRuns}
          extra={
            <Button size="small" onClick={() => refetchStuckRuns()}>
              Проверить
            </Button>
          }
        >
          {stuckRuns && stuckRuns.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message={`Найдено зависших задач: ${stuckRuns.length}`}
                description="Эти задачи выполняются более 10 минут. Возможно, требуется вмешательство."
                type="error"
                showIcon
              />
              <Table
                dataSource={stuckRuns}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
                  {
                    title: 'Статус',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
                  },
                  {
                    title: 'Начало',
                    dataIndex: 'started_at',
                    key: 'started_at',
                    render: (date) => new Date(date).toLocaleString('ru-RU'),
                  },
                  {
                    title: 'Длительность',
                    dataIndex: 'duration_minutes',
                    key: 'duration_minutes',
                    render: (mins) => `${mins} мин`,
                  },
                ]}
              />
            </Space>
          ) : (
            <Alert
              message="Всё в порядке"
              description="Зависших задач не найдено. Все pipeline запускаются корректно."
              type="success"
              showIcon
            />
          )}
        </Card>

        {/* Check 3: pg_cron Jobs */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>3. pg_cron задачи</span>
            </Space>
          }
          loading={loadingCronJobs}
          extra={
            <Button size="small" onClick={() => refetchCronJobs()}>
              Проверить
            </Button>
          }
        >
          {cronJobs && cronJobs.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Table
                dataSource={cronJobs}
                rowKey="jobname"
                pagination={false}
                columns={[
                  { title: 'Название', dataIndex: 'jobname', key: 'jobname' },
                  {
                    title: 'Статус',
                    dataIndex: 'active',
                    key: 'active',
                    render: (active) =>
                      active ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          Активна
                        </Tag>
                      ) : (
                        <Tag color="error" icon={<CloseCircleOutlined />}>
                          Неактивна
                        </Tag>
                      ),
                  },
                  { title: 'Расписание', dataIndex: 'schedule', key: 'schedule' },
                ]}
              />
              {cronJobs.every((job) => job.active) ? (
                <Alert
                  message="Всё в порядке"
                  description="Все pg_cron задачи активны и работают по расписанию."
                  type="success"
                  showIcon
                />
              ) : (
                <Alert
                  message="Внимание"
                  description="Некоторые pg_cron задачи неактивны. Проверьте конфигурацию."
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          ) : (
            <Alert message="pg_cron задачи не найдены" type="warning" showIcon />
          )}
        </Card>

        {/* Check 4: Recent Documents */}
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>4. Документы за последние 24 часа</span>
            </Space>
          }
          loading={loadingRecentDocs}
          extra={
            <Button size="small" onClick={() => refetchRecentDocs()}>
              Проверить
            </Button>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Statistic
              title="Создано документов"
              value={recentDocs}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: recentDocs === 0 ? '#ff4d4f' : '#52c41a' }}
            />

            {recentDocs === 0 ? (
              <Alert
                message="Внимание"
                description="За последние 24 часа не было создано ни одного документа. Проверьте работу pipeline."
                type="warning"
                showIcon
              />
            ) : recentDocs < 5 ? (
              <Alert
                message="Низкая активность"
                description={`Создано всего ${recentDocs} документов за 24 часа. Возможно, источники дают мало данных.`}
                type="info"
                showIcon
              />
            ) : (
              <Alert
                message="Всё в порядке"
                description={`Система активно собирает данные. Создано ${recentDocs} документов за последние 24 часа.`}
                type="success"
                showIcon
              />
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default DailyChecks;
