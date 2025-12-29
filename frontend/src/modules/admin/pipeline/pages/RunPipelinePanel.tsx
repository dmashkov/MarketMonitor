/**
 * RunPipelinePanel Component V2
 *
 * Admin UI for running the search orchestrator pipeline with Scope-Aware profiles
 *
 * V2 FEATURES:
 * - 3 monitoring profile cards (Daily/Weekly/Monthly)
 * - Visual priority indicators (🔥 HIGH / 📊 MEDIUM / 🌍 LOW)
 * - Profile metadata display (max sources, min priority, etc.)
 * - One-click pipeline execution per profile
 *
 * WORKFLOW:
 * - Display all active monitoring profiles sorted by priority
 * - User clicks "Запустить" button on desired profile
 * - Pipeline executes with profile's scope-aware settings
 * - Progress and results displayed below
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Spin,
  Statistic,
  Row,
  Col,
  Empty,
  Result,
  Table,
  Descriptions,
  Tag,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  BarChartOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import {
  usePipelineRunner,
  useMonitoringProfiles,
  useSearchRunHistory,
  PipelineRunResponse,
} from '../hooks/usePipelineRunner';
import { PipelineProgress } from '../components/PipelineProgress';

export const RunPipelinePanel: React.FC = () => {
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [currentSearchRunId, setCurrentSearchRunId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PipelineRunResponse | null>(null);

  const { mutate: runPipeline } = usePipelineRunner();
  const { data: profiles, isLoading: profilesLoading } = useMonitoringProfiles();
  const { data: runHistory, refetch: refetchHistory } = useSearchRunHistory();

  const isRunning = activeProfileId !== null;

  // Poll for status updates while running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      refetchHistory();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isRunning, refetchHistory]);

  const handleStartPipeline = (profileId: string, profileName: string) => {
    console.log('🚀 Starting pipeline with profile:', profileId, profileName);
    setActiveProfileId(profileId);
    setLastResult(null);

    runPipeline(
      { monitoring_profile_id: profileId },
      {
        onSuccess: (result) => {
          setCurrentSearchRunId(result.search_run_id);
          setLastResult(result);

          if (result.status === 'completed') {
            message.success(`Pipeline "${profileName}" выполнен успешно!`);
            setActiveProfileId(null);
          } else if (result.status === 'failed') {
            message.error(`Pipeline завершился с ошибкой: ${result.error || 'Неизвестная ошибка'}`);
            setActiveProfileId(null);
          }

          refetchHistory();
        },
        onError: (error) => {
          setActiveProfileId(null);
          message.error(`Ошибка при запуске pipeline: ${error.message}`);
        },
      }
    );
  };

  // Helper to get profile icon
  const getProfileIcon = (priority: number) => {
    if (priority >= 5) return <FireOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />;
    if (priority >= 3) return <BarChartOutlined style={{ fontSize: '24px', color: '#1890ff' }} />;
    return <GlobalOutlined style={{ fontSize: '24px', color: '#52c41a' }} />;
  };

  // Helper to get priority tag
  const getPriorityTag = (priority: number) => {
    if (priority >= 5) return <Tag color="red">HIGH</Tag>;
    if (priority >= 3) return <Tag color="blue">MEDIUM</Tag>;
    return <Tag color="green">LOW</Tag>;
  };

  return (
    <div>
      {/* DEBUG CARD - TEMPORARY */}
      <Card style={{ marginBottom: '16px', background: '#fff7e6', borderColor: '#ffd591' }}>
        <Space>
          <Button
            onClick={async () => {
              console.log('🔍 Testing debug-env...');
              const { supabase } = await import('@/lib/supabase');

              const { data, error } = await supabase.functions.invoke('debug-env', { body: {} });
              console.log('✅ Debug result:', { data, error });

              const session = await supabase.auth.getSession();
              console.log('👤 Session:', session.data.session ? 'Logged in ✅' : 'Not logged in ❌');
              console.log('User:', session.data.session?.user?.email);

              message.info('Check browser console (F12) for debug info');
            }}
          >
            🔍 Test Debug Function
          </Button>
          <span style={{ color: '#fa8c16' }}>Временная кнопка для отладки - проверьте консоль (F12)</span>
        </Space>
      </Card>

      {/* Monitoring Profiles Cards */}
      <Card style={{ marginBottom: '24px' }}>
        <h2>🚀 Запуск Pipeline - Выберите профиль мониторинга</h2>

        {profilesLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <p style={{ marginTop: '16px' }}>Загрузка профилей мониторинга...</p>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {profiles
              .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // Sort by priority DESC
              .map((profile) => (
                <Card
                  key={profile.id}
                  type="inner"
                  title={
                    <Space>
                      {getProfileIcon(profile.priority || 3)}
                      <span style={{ fontSize: '18px', fontWeight: 600 }}>{profile.name}</span>
                      {getPriorityTag(profile.priority || 3)}
                    </Space>
                  }
                  extra={
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlayCircleOutlined />}
                      loading={activeProfileId === profile.id}
                      disabled={isRunning && activeProfileId !== profile.id}
                      onClick={() => handleStartPipeline(profile.id, profile.name)}
                    >
                      {activeProfileId === profile.id ? 'Выполняется...' : 'Запустить'}
                    </Button>
                  }
                  style={{
                    borderLeft: `4px solid ${
                      profile.priority >= 5 ? '#ff4d4f' : profile.priority >= 3 ? '#1890ff' : '#52c41a'
                    }`,
                  }}
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Описание" span={2}>
                      {profile.description || 'Нет описания'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Макс. источников">
                      {profile.max_sources_per_run || 20}
                    </Descriptions.Item>
                    <Descriptions.Item label="Мин. приоритет источников">
                      {profile.min_source_priority || 1}
                    </Descriptions.Item>
                    <Descriptions.Item label="Порог дедупликации">
                      {profile.dedupe_threshold ? `${(profile.dedupe_threshold * 100).toFixed(0)}%` : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Статус">
                      {profile.is_active ? (
                        <Tag color="green">Активен</Tag>
                      ) : (
                        <Tag color="default">Неактивен</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ))}
          </Space>
        ) : (
          <Empty
            description="Профили мониторинга не найдены"
            style={{ padding: '40px' }}
          />
        )}
      </Card>

      {/* Progress Display */}
      {currentSearchRunId && (
        <PipelineProgress searchRunId={currentSearchRunId} isRunning={isRunning} />
      )}

      {/* Result Summary */}
      {lastResult && !isRunning && (
        <Card style={{ marginTop: '24px' }}>
          {lastResult.status === 'completed' ? (
            <>
              <Result
                status="success"
                title="Pipeline завершен успешно"
                subTitle={lastResult.message}
              />

              <Row gutter={16} style={{ marginTop: '24px' }}>
                <Col span={8}>
                  <Statistic
                    title="Создано документов"
                    value={lastResult.documents_created || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Создано событий"
                    value={lastResult.events_created || 0}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Время выполнения"
                    value={lastResult.duration_seconds || 0}
                    suffix="сек"
                    precision={1}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
              </Row>
            </>
          ) : lastResult.status === 'failed' ? (
            <Result
              status="error"
              title="Pipeline завершился с ошибкой"
              subTitle={lastResult.error || lastResult.message || 'Неизвестная ошибка'}
              extra={
                lastResult?.monitoring_profile_id && (
                  <Button
                    type="primary"
                    onClick={() => {
                      const profile = profiles?.find(p => p.id === lastResult.monitoring_profile_id);
                      if (profile) {
                        handleStartPipeline(profile.id, profile.name);
                      }
                    }}
                  >
                    Повторить
                  </Button>
                )
              }
            />
          ) : (
            <Spin />
          )}
        </Card>
      )}

      {/* History Table */}
      <Card style={{ marginTop: '24px' }}>
        <h3>История запусков</h3>

        {runHistory && runHistory.length > 0 ? (
          <Table
            columns={[
              {
                title: 'Статус',
                dataIndex: 'status',
                key: 'status',
                render: (status: string) => (
                  <span>
                    {status === 'completed' && (
                      <>
                        <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                        Завершено
                      </>
                    )}
                    {status === 'failed' && (
                      <>
                        <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: '8px' }} />
                        Ошибка
                      </>
                    )}
                    {status === 'running' && (
                      <>
                        <Spin size="small" style={{ marginRight: '8px' }} />
                        В процессе
                      </>
                    )}
                  </span>
                ),
              },
              {
                title: 'Документов',
                dataIndex: 'documents_created',
                key: 'documents_created',
              },
              {
                title: 'Событий',
                dataIndex: 'events_created',
                key: 'events_created',
              },
              {
                title: 'Время выполнения (ms)',
                dataIndex: 'execution_time_ms',
                key: 'execution_time_ms',
                render: (value: number | null) => value ? `${(value / 1000).toFixed(1)}s` : '-',
              },
              {
                title: 'Дата',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (date: string) => new Date(date).toLocaleString('ru-RU'),
              },
            ]}
            dataSource={runHistory}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty description="История запусков пуста" />
        )}
      </Card>
    </div>
  );
};
