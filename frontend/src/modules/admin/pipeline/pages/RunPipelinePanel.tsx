/**
 * RunPipelinePanel Component
 *
 * Admin UI for running the search orchestrator pipeline
 * - Select monitoring profile
 * - Start pipeline execution
 * - Display progress and results
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  Spin,
  Alert,
  Statistic,
  Row,
  Col,
  Empty,
  Result,
  Table,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  usePipelineRunner,
  useMonitoringProfiles,
  useSearchRunHistory,
  PipelineRunResponse,
} from '../hooks/usePipelineRunner';
import { PipelineProgress } from '../components/PipelineProgress';

export const RunPipelinePanel: React.FC = () => {
  const [form] = Form.useForm();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [currentSearchRunId, setCurrentSearchRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<PipelineRunResponse | null>(null);

  const { mutate: runPipeline, isPending: isExecuting } = usePipelineRunner();
  const { data: profiles, isLoading: profilesLoading } = useMonitoringProfiles();
  const { data: runHistory, refetch: refetchHistory } = useSearchRunHistory();

  // Poll for status updates while running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      refetchHistory();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isRunning, refetchHistory]);

  const handleStartPipeline = async () => {
    if (!selectedProfile) {
      Alert.error('Пожалуйста, выберите профиль мониторинга');
      return;
    }

    console.log('🚀 Starting pipeline with profile:', selectedProfile);
    setIsRunning(true);
    setLastResult(null);

    runPipeline(
      { monitoring_profile_id: selectedProfile },
      {
        onSuccess: (result) => {
          setCurrentSearchRunId(result.search_run_id);
          setLastResult(result);
          setIsRunning(result.status === 'running');

          if (result.status === 'completed') {
            Alert.success('Pipeline выполнен успешно!');
          } else if (result.status === 'failed') {
            Alert.error(`Pipeline завершился с ошибкой: ${result.error || 'Неизвестная ошибка'}`);
          }

          refetchHistory();
        },
        onError: (error) => {
          setIsRunning(false);
          Alert.error(`Ошибка при запуске pipeline: ${error.message}`);
        },
      }
    );
  };

  const profileOptions = profiles?.map((p) => ({
    label: p.name,
    value: p.id,
    description: p.description,
  })) || [];

  return (
    <div>
      {/* Control Panel */}
      <Card style={{ marginBottom: '24px' }}>
        <h2>🚀 Запуск Pipeline</h2>

        <Form form={form} layout="vertical">
          <Form.Item label="Профиль мониторинга" required>
            <Select
              placeholder="Выберите профиль мониторинга"
              value={selectedProfile}
              onChange={setSelectedProfile}
              options={profileOptions}
              disabled={isExecuting || isRunning}
              loading={profilesLoading}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartPipeline}
                disabled={!selectedProfile || isRunning}
                loading={isExecuting}
                size="large"
              >
                Запустить Pipeline
              </Button>

              {isRunning && (
                <Button icon={<ReloadOutlined spin />} disabled>
                  Выполняется...
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
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
                <Button
                  type="primary"
                  onClick={handleStartPipeline}
                  disabled={!selectedProfile}
                >
                  Повторить
                </Button>
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
