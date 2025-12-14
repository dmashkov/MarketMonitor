/**
 * PipelineLogs Component
 *
 * Displays execution history of pipeline runs with detailed statistics
 * - Shows all search_runs with timestamps and statuses
 * - Expandable rows to show stage-by-stage progress
 * - Filters by date range and status
 * - Real-time updates
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Tag,
  Space,
  Button,
  Drawer,
  Statistic,
  Row,
  Col,
  Empty,
  Spin,
  Timeline,
  Badge,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';

interface SearchRun {
  id: string;
  type: string;
  status: 'running' | 'completed' | 'failed';
  monitoring_profile_id: string;
  documents_created: number;
  events_created: number;
  started_at: string;
  completed_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  created_by: string | null;
}

interface SearchRunStage {
  id: string;
  search_run_id: string;
  stage_name: string;
  status: string;
  documents_processed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

interface ExpandedRowData {
  stages: SearchRunStage[];
}

export const PipelineLogs: React.FC = () => {
  const [selectedRun, setSelectedRun] = useState<SearchRun | null>(null);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // Fetch search runs
  const { data: runs, isLoading, refetch } = useQuery({
    queryKey: ['search_runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as SearchRun[];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch stages for a specific run
  const fetchStages = async (runId: string): Promise<SearchRunStage[]> => {
    const { data, error } = await supabase
      .from('search_runs_stages')
      .select('*')
      .eq('search_run_id', runId)
      .order('started_at', { ascending: true });

    if (error) throw error;
    return (data || []) as SearchRunStage[];
  };

  // Delete search run
  const { mutate: deleteRun } = useMutation({
    mutationFn: async (runId: string) => {
      // Delete stages first (cascade)
      await supabase
        .from('search_runs_stages')
        .delete()
        .eq('search_run_id', runId);

      // Delete search run
      const { error } = await supabase
        .from('search_runs')
        .delete()
        .eq('id', runId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Expand row handler
  const handleExpandRow = async (record: SearchRun) => {
    if (expandedRowKeys.includes(record.id)) {
      setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
    } else {
      setExpandedRowKeys([...expandedRowKeys, record.id]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return null;
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

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />;
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />;
      case 'running':
        return <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '16px' }} />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const columns = [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Space>
          {getStatusIcon(status)}
          <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
        </Space>
      ),
    },
    {
      title: 'Время начала',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('ru-RU'),
      sorter: (a: SearchRun, b: SearchRun) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    },
    {
      title: 'Длительность',
      dataIndex: 'execution_time_ms',
      key: 'execution_time_ms',
      width: 120,
      render: (ms: number | null) => (
        <span style={{ fontFamily: 'monospace' }}>{formatDuration(ms)}</span>
      ),
      sorter: (a: SearchRun, b: SearchRun) =>
        (a.execution_time_ms || 0) - (b.execution_time_ms || 0),
    },
    {
      title: 'Документы',
      dataIndex: 'documents_created',
      key: 'documents_created',
      width: 120,
      render: (count: number) => <Badge count={count} color="#1890ff" />,
      sorter: (a: SearchRun, b: SearchRun) => a.documents_created - b.documents_created,
    },
    {
      title: 'События',
      dataIndex: 'events_created',
      key: 'events_created',
      width: 100,
      render: (count: number) => <Badge count={count} color="#faad14" />,
    },
    {
      title: 'Сообщение',
      dataIndex: 'error_message',
      key: 'error_message',
      width: 300,
      render: (msg: string | null) =>
        msg ? (
          <span
            style={{
              color: '#ff4d4f',
              fontSize: '12px',
              maxWidth: '300px',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={msg}
          >
            {msg}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_, record: SearchRun) => (
        <Space>
          <Button
            type="text"
            size="small"
            onClick={() => setSelectedRun(record)}
          >
            Детали
          </Button>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => deleteRun(record.id)}
          />
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: SearchRun) => {
    // Use React Query to auto-update stages
    const { data: stages, isLoading: stagesLoading } = useQuery({
      queryKey: ['search-run-stages', record.id],
      queryFn: async () => {
        return await fetchStages(record.id);
      },
      refetchInterval: 2000, // Auto-refresh every 2 seconds while running
    });

    if (stagesLoading) {
      return <Spin />;
    }

    if (!stages || stages.length === 0) {
      return <Empty description="Нет данных о стадиях" />;
    }

    return (
      <Card
        style={{
          backgroundColor: '#f5f5f5',
          border: 'none',
          marginTop: '12px',
        }}
      >
        <h4 style={{ marginBottom: '16px' }}>📊 Прогресс по стадиям</h4>
        <Timeline
          items={stages.map((stage) => ({
            dot: getStageStatusIcon(stage.status),
            children: (
              <div>
                <div style={{ fontWeight: 600 }}>
                  {stage.stage_name.toUpperCase()}
                </div>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                  {/* Timing */}
                  <div style={{ marginBottom: '4px' }}>
                    ⏱️ {new Date(stage.started_at).toLocaleTimeString('ru-RU')}
                    {stage.completed_at &&
                      ` - ${new Date(stage.completed_at).toLocaleTimeString('ru-RU')}`}
                  </div>

                  {/* Duration */}
                  {stage.started_at && stage.completed_at && (
                    <div style={{ marginBottom: '4px', fontStyle: 'italic' }}>
                      ⏳ Длительность: {((new Date(stage.completed_at).getTime() - new Date(stage.started_at).getTime()) / 1000).toFixed(1)}s
                    </div>
                  )}

                  {/* Results */}
                  {stage.documents_processed > 0 && (
                    <div style={{ marginBottom: '4px', fontWeight: 500 }}>
                      ✅ {stage.stage_name === 'source_hunter' && `Найдено ${stage.documents_processed} источников/документов`}
                      {stage.stage_name === 'content_fetcher' && `Загружено контента для ${stage.documents_processed} документов`}
                      {stage.stage_name === 'document_processor' && `Обработано и классифицировано ${stage.documents_processed} документов`}
                      {stage.stage_name === 'dedup' && `Уникальных документов: ${stage.documents_processed}`}
                      {stage.stage_name === 'criticality_scorer' && `Оценено ${stage.documents_processed} документов`}
                      {stage.stage_name === 'event_extractor' && `Извлечено событий: ${stage.documents_processed}`}
                    </div>
                  )}

                  {/* Error */}
                  {stage.error_message && (
                    <div style={{ color: '#ff4d4f', marginTop: '4px', padding: '4px', backgroundColor: '#fff2f0', borderRadius: '2px' }}>
                      ❌ Ошибка: {stage.error_message}
                    </div>
                  )}
                </div>
              </div>
            ),
          }))}
        />
      </Card>
    );
  };

  if (isLoading) {
    return <Spin />;
  }

  if (!runs || runs.length === 0) {
    return (
      <Card>
        <Empty
          description="Нет истории запусков"
          style={{ marginTop: '40px', marginBottom: '40px' }}
        />
      </Card>
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <Row gutter={24} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Всего запусков"
              value={runs.length}
              prefix={<Badge count={runs.length} color="#1890ff" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Успешных"
              value={runs.filter((r) => r.status === 'completed').length}
              valueStyle={{ color: '#52c41a' }}
              suffix="✅"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Ошибок"
              value={runs.filter((r) => r.status === 'failed').length}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="❌"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Документов создано"
              value={runs.reduce((sum, r) => sum + r.documents_created, 0)}
              suffix="📄"
            />
          </Card>
        </Col>
      </Row>

      {/* Logs Table */}
      <Card>
        <h3 style={{ marginBottom: '16px' }}>📋 История запусков</h3>
        <Table
          columns={columns}
          dataSource={runs}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
          }}
          size="small"
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
            expandedRowRender,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={`Детали запуска ${selectedRun?.id?.slice(0, 8)}`}
        placement="right"
        onClose={() => setSelectedRun(null)}
        open={!!selectedRun}
        width={500}
      >
        {selectedRun && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>STATUS</p>
              <Tag color={getStatusColor(selectedRun.status)}>
                {selectedRun.status.toUpperCase()}
              </Tag>
            </div>

            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>ID ЗАПУСКА</p>
              <code style={{ color: '#1890ff' }}>{selectedRun.id}</code>
            </div>

            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>ВРЕМЯ НАЧАЛА</p>
              <span>{new Date(selectedRun.started_at).toLocaleString('ru-RU')}</span>
            </div>

            {selectedRun.completed_at && (
              <div>
                <p style={{ color: '#666', fontSize: '12px' }}>ВРЕМЯ ЗАВЕРШЕНИЯ</p>
                <span>{new Date(selectedRun.completed_at).toLocaleString('ru-RU')}</span>
              </div>
            )}

            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>ДЛИТЕЛЬНОСТЬ</p>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>
                {formatDuration(selectedRun.execution_time_ms)}
              </span>
            </div>

            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>ДОКУМЕНТЫ СОЗДАНЫ</p>
              <Badge count={selectedRun.documents_created} color="#1890ff" />
            </div>

            <div>
              <p style={{ color: '#666', fontSize: '12px' }}>СОБЫТИЯ СОЗДАНЫ</p>
              <Badge count={selectedRun.events_created} color="#faad14" />
            </div>

            {selectedRun.error_message && (
              <div>
                <p style={{ color: '#666', fontSize: '12px' }}>СООБЩЕНИЕ ОБ ОШИБКЕ</p>
                <div
                  style={{
                    backgroundColor: '#fff2f0',
                    border: '1px solid #ffccc7',
                    borderRadius: '4px',
                    padding: '8px',
                    color: '#ff4d4f',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    maxHeight: '150px',
                    overflow: 'auto',
                  }}
                >
                  {selectedRun.error_message}
                </div>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};
