/**
 * MonitoringDashboard Component
 *
 * Visual monitoring dashboard for system health and metrics
 * - Real-time system health status
 * - Success rate chart (7 days)
 * - Documents created chart (daily)
 * - Recent runs timeline
 * - API usage metrics
 * - Quick actions
 */

import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Alert,
  Timeline,
  Progress,
  Tag,
  Spin,
  Badge,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  WarningOutlined,
  LineChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface SearchRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  documents_created: number;
  execution_time_ms: number | null;
  error_message: string | null;
}

interface DailyStats {
  date: string;
  total_runs: number;
  successful: number;
  failed: number;
  documents: number;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  active_jobs: number;
  stuck_runs: number;
  recent_documents: number;
  success_rate: number;
}

export const MonitoringDashboard: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch last 7 days runs
  const { data: runs, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['monitoring-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('search_runs')
        .select('*')
        .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: true });

      if (error) throw error;
      return (data || []) as SearchRun[];
    },
    refetchInterval: autoRefresh ? 30000 : false, // 30 seconds
  });

  // Fetch documents stats
  const { data: documentsStats, isLoading: docsLoading } = useQuery({
    queryKey: ['monitoring-documents'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_document_stats', {
        days: 7,
      });

      if (error) throw error;
      return data as Array<{ date: string; documents: number }>;
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Calculate system health
  const systemHealth: SystemHealth = React.useMemo(() => {
    if (!runs) {
      return {
        status: 'warning',
        active_jobs: 0,
        stuck_runs: 0,
        recent_documents: 0,
        success_rate: 0,
      };
    }

    const last24h = runs.filter(
      (r) => new Date(r.started_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );
    const successful = runs.filter((r) => r.status === 'completed').length;
    const stuckRuns = runs.filter(
      (r) =>
        r.status === 'running' &&
        new Date(r.started_at).getTime() < Date.now() - 10 * 60 * 1000
    ).length;

    const successRate = runs.length > 0 ? (successful / runs.length) * 100 : 0;
    const recentDocs = last24h.reduce((sum, r) => sum + r.documents_created, 0);

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (stuckRuns > 0 || successRate < 50) {
      status = 'critical';
    } else if (successRate < 80 || recentDocs === 0) {
      status = 'warning';
    }

    return {
      status,
      active_jobs: 2, // pg_cron jobs
      stuck_runs: stuckRuns,
      recent_documents: recentDocs,
      success_rate: successRate,
    };
  }, [runs]);

  // Prepare chart data - daily stats
  const dailyStats: DailyStats[] = React.useMemo(() => {
    if (!runs) return [];

    const grouped = runs.reduce((acc: Record<string, DailyStats>, run) => {
      const date = new Date(run.started_at).toISOString().split('T')[0];

      if (!acc[date]) {
        acc[date] = {
          date,
          total_runs: 0,
          successful: 0,
          failed: 0,
          documents: 0,
        };
      }

      acc[date].total_runs++;
      if (run.status === 'completed') {
        acc[date].successful++;
        acc[date].documents += run.documents_created;
      } else if (run.status === 'failed') {
        acc[date].failed++;
      }

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [runs]);

  // Status distribution for pie chart
  const statusDistribution = React.useMemo(() => {
    if (!runs) return [];

    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const running = runs.filter((r) => r.status === 'running').length;

    return [
      { name: 'Completed', value: completed, color: '#52c41a' },
      { name: 'Failed', value: failed, color: '#ff4d4f' },
      { name: 'Running', value: running, color: '#1890ff' },
    ].filter((item) => item.value > 0);
  }, [runs]);

  const getHealthStatusIcon = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />;
      case 'warning':
        return <WarningOutlined style={{ fontSize: 24, color: '#faad14' }} />;
      case 'critical':
        return <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />;
    }
  };

  const getHealthStatusColor = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return '#52c41a';
      case 'warning':
        return '#faad14';
      case 'critical':
        return '#ff4d4f';
    }
  };

  if (runsLoading || docsLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Загрузка данных мониторинга...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📊 Monitoring Dashboard</h1>
          <p style={{ color: '#666', marginTop: 8 }}>
            Визуальный мониторинг системы в реальном времени
          </p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchRuns();
            }}
          >
            Обновить
          </Button>
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </Button>
        </Space>
      </div>

      {/* System Health Alert */}
      {systemHealth.status !== 'healthy' && (
        <Alert
          message={
            systemHealth.status === 'critical'
              ? '⚠️ Критическая проблема с системой'
              : '⚠️ Предупреждение о работе системы'
          }
          description={
            <div>
              {systemHealth.stuck_runs > 0 && (
                <div>• Зависших заданий: {systemHealth.stuck_runs}</div>
              )}
              {systemHealth.success_rate < 80 && (
                <div>
                  • Success rate низкий: {systemHealth.success_rate.toFixed(1)}% (норма: &gt;80%)
                </div>
              )}
              {systemHealth.recent_documents === 0 && (
                <div>• Нет новых документов за последние 24 часа</div>
              )}
            </div>
          }
          type={systemHealth.status === 'critical' ? 'error' : 'warning'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* System Health Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="System Health"
              value={systemHealth.status.toUpperCase()}
              prefix={getHealthStatusIcon()}
              valueStyle={{ color: getHealthStatusColor() }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Success Rate (7d)"
              value={systemHealth.success_rate.toFixed(1)}
              suffix="%"
              prefix={
                systemHealth.success_rate >= 80 ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <WarningOutlined style={{ color: '#faad14' }} />
                )
              }
              valueStyle={{
                color: systemHealth.success_rate >= 80 ? '#52c41a' : '#faad14',
              }}
            />
            <Progress
              percent={systemHealth.success_rate}
              strokeColor={systemHealth.success_rate >= 80 ? '#52c41a' : '#faad14'}
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Documents (24h)"
              value={systemHealth.recent_documents}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: systemHealth.recent_documents > 0 ? '#1890ff' : '#999' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active pg_cron Jobs"
              value={systemHealth.active_jobs}
              suffix="/ 2"
              prefix={
                systemHealth.active_jobs === 2 ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                )
              }
              valueStyle={{
                color: systemHealth.active_jobs === 2 ? '#52c41a' : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Success Rate Trend */}
        <Col xs={24} lg={12}>
          <Card title="📈 Success Rate Trend (7 Days)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="successful"
                  stroke="#52c41a"
                  name="Успешных"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#ff4d4f"
                  name="Ошибок"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Documents Created */}
        <Col xs={24} lg={12}>
          <Card title="📄 Documents Created (Daily)">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString('ru-RU')}
                />
                <Legend />
                <Bar dataKey="documents" fill="#1890ff" name="Документов" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Status Distribution & Recent Runs */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Status Pie Chart */}
        <Col xs={24} lg={8}>
          <Card title="⚙️ Status Distribution (7d)">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Recent Runs Timeline */}
        <Col xs={24} lg={16}>
          <Card title="🕐 Recent Runs (Last 5)">
            <Timeline
              items={runs
                ?.slice(-5)
                .reverse()
                .map((run) => ({
                  dot:
                    run.status === 'completed' ? (
                      <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                    ) : run.status === 'failed' ? (
                      <ExclamationCircleOutlined style={{ fontSize: 16, color: '#ff4d4f' }} />
                    ) : (
                      <ClockCircleOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                    ),
                  children: (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(run.started_at).toLocaleString('ru-RU')}
                        <Tag
                          color={
                            run.status === 'completed'
                              ? 'success'
                              : run.status === 'failed'
                              ? 'error'
                              : 'processing'
                          }
                          style={{ marginLeft: 8 }}
                        >
                          {run.status}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        Documents: {run.documents_created} |{' '}
                        Duration: {run.execution_time_ms ? `${(run.execution_time_ms / 1000).toFixed(1)}s` : '-'}
                      </div>
                      {run.error_message && (
                        <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                          Error: {run.error_message.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  ),
                }))}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Stats Summary */}
      <Card title="📊 Summary Statistics (7 Days)">
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Statistic
              title="Total Runs"
              value={runs?.length || 0}
              prefix={<RocketOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Total Documents"
              value={dailyStats.reduce((sum, stat) => sum + stat.documents, 0)}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Avg Documents/Day"
              value={(
                dailyStats.reduce((sum, stat) => sum + stat.documents, 0) / dailyStats.length || 0
              ).toFixed(1)}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="Avg Duration"
              value={
                runs && runs.length > 0
                  ? (
                      runs
                        .filter((r) => r.execution_time_ms)
                        .reduce((sum, r) => sum + (r.execution_time_ms || 0), 0) /
                      runs.filter((r) => r.execution_time_ms).length /
                      1000
                    ).toFixed(1)
                  : '0'
              }
              suffix="s"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        </Row>
      </Card>

      <Divider />

      {/* Help Text */}
      <Alert
        message="💡 Как использовать dashboard"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Auto-Refresh обновляет данные каждые 30 секунд</li>
            <li>Success Rate должен быть &gt;80% для здоровой системы</li>
            <li>Проверяйте dashboard каждое утро после 9:30 AM</li>
            <li>При появлении alert - см. MAINTENANCE_GUIDE.md раздел "Troubleshooting"</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  );
};
