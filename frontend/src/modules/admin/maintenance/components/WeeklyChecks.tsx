/**
 * WeeklyChecks
 *
 * Еженедельные проверки системы (15 минут)
 */

import React from 'react';
import { Card, Button, Space, Alert, Statistic, Row, Col, Typography } from 'antd';
import {
  SyncOutlined,
  LineChartOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const { Title, Paragraph } = Typography;

interface WeeklyStats {
  total_runs: number;
  successful: number;
  failed: number;
  total_documents: number;
  success_rate: number;
  avg_duration_sec: number;
  avg_docs_per_run: number;
}

/**
 * Компонент еженедельных проверок
 */
export const WeeklyChecks: React.FC = () => {
  // Weekly stats
  const {
    data: weeklyStats,
    isLoading: loadingWeeklyStats,
    refetch: refetchWeeklyStats,
  } = useQuery({
    queryKey: ['maintenance-weekly-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_weekly_stats').single();

      if (error) throw error;
      return data as WeeklyStats;
    },
  });

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>Еженедельные проверки (15 минут)</Title>
            <Paragraph type="secondary">
              Проверки, которые следует выполнять каждую неделю для анализа производительности
            </Paragraph>
            <Button type="primary" icon={<SyncOutlined />} onClick={() => refetchWeeklyStats()}>
              Обновить статистику
            </Button>
          </Space>
        </Card>

        {/* Weekly Pipeline Statistics */}
        <Card
          title={
            <Space>
              <LineChartOutlined />
              <span>Статистика Pipeline за 7 дней</span>
            </Space>
          }
          loading={loadingWeeklyStats}
          extra={
            <Button size="small" onClick={() => refetchWeeklyStats()}>
              Проверить
            </Button>
          }
        >
          {weeklyStats ? (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Main Stats */}
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="Всего запусков"
                    value={weeklyStats.total_runs}
                    prefix={<LineChartOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Успешных"
                    value={weeklyStats.successful}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Ошибок"
                    value={weeklyStats.failed}
                    prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Success Rate"
                    value={weeklyStats.success_rate}
                    suffix="%"
                    valueStyle={{
                      color: weeklyStats.success_rate >= 80 ? '#52c41a' : weeklyStats.success_rate >= 50 ? '#faad14' : '#ff4d4f',
                    }}
                  />
                </Col>
              </Row>

              {/* Secondary Stats */}
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic
                    title="Всего документов"
                    value={weeklyStats.total_documents}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Среднее время выполнения"
                    value={weeklyStats.avg_duration_sec}
                    suffix="сек"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Документов на запуск"
                    value={weeklyStats.avg_docs_per_run}
                    precision={1}
                  />
                </Col>
              </Row>

              {/* Analysis */}
              <Space direction="vertical" style={{ width: '100%' }}>
                {weeklyStats.success_rate >= 80 && weeklyStats.total_documents > 50 ? (
                  <Alert
                    message="Отличная производительность"
                    description={`Success rate ${weeklyStats.success_rate}% и ${weeklyStats.total_documents} документов создано за неделю. Система работает стабильно.`}
                    type="success"
                    showIcon
                  />
                ) : weeklyStats.success_rate >= 50 ? (
                  <Alert
                    message="Требует внимания"
                    description={`Success rate ${weeklyStats.success_rate}% - ниже целевого (80%). Рекомендуется проверить ошибки и качество источников.`}
                    type="warning"
                    showIcon
                  />
                ) : (
                  <Alert
                    message="Критическая ситуация"
                    description={`Success rate ${weeklyStats.success_rate}% - критически низкий. Требуется срочное вмешательство.`}
                    type="error"
                    showIcon
                  />
                )}

                {weeklyStats.total_documents < 20 && weeklyStats.total_runs > 0 && (
                  <Alert
                    message="Низкая продуктивность"
                    description={`Создано всего ${weeklyStats.total_documents} документов за неделю (в среднем ${weeklyStats.avg_docs_per_run} на запуск). Проверьте качество источников и промптов.`}
                    type="warning"
                    showIcon
                  />
                )}

                {weeklyStats.avg_duration_sec > 180 && (
                  <Alert
                    message="Долгое выполнение"
                    description={`Среднее время выполнения ${weeklyStats.avg_duration_sec} секунд (> 3 минут). Возможно, стоит оптимизировать pipeline.`}
                    type="info"
                    showIcon
                  />
                )}
              </Space>
            </Space>
          ) : (
            <Alert message="Статистика недоступна" type="info" />
          )}
        </Card>

        {/* Recommendations */}
        <Card title="Рекомендации по еженедельному обслуживанию">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Paragraph>
              <strong>1. Анализ производительности</strong>
              <ul>
                <li>Success rate должен быть {'>'} 80%</li>
                <li>Среднее количество документов на запуск {'>'} 5</li>
                <li>Время выполнения {'<'} 3 минут</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>2. Проверка источников</strong>
              <ul>
                <li>Удалите неактивные источники (0 документов за неделю)</li>
                <li>Добавьте новые источники при необходимости</li>
                <li>Проверьте приоритеты источников</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>3. Качество данных</strong>
              <ul>
                <li>Проверьте дубликаты документов</li>
                <li>Убедитесь, что embeddings генерируются</li>
                <li>Проверьте качество извлечённых событий</li>
              </ul>
            </Paragraph>

            <Paragraph>
              <strong>4. База данных</strong>
              <ul>
                <li>Проверьте размер таблиц (должен расти постепенно)</li>
                <li>Убедитесь, что индексы работают</li>
                <li>Проверьте логи на предмет предупреждений</li>
              </ul>
            </Paragraph>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default WeeklyChecks;
