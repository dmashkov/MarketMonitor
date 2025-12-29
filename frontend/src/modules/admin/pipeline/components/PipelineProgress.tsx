/**
 * PipelineProgress Component
 *
 * Displays pipeline execution progress with stages
 */

import React from 'react';
import { Card, Progress, Space, Tag, Spin, Empty, Timeline } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useSearchRunStages } from '../hooks/usePipelineRunner';

interface PipelineProgressProps {
  searchRunId: string | null;
  isRunning: boolean;
}

export const PipelineProgress: React.FC<PipelineProgressProps> = ({ searchRunId, isRunning }) => {
  const { data: stages, isLoading } = useSearchRunStages(searchRunId || '');

  if (!searchRunId) {
    return (
      <Card style={{ marginTop: '16px' }}>
        <Empty description="Нет активного процесса" />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card style={{ marginTop: '16px' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <p style={{ marginTop: '16px' }}>Загрузка статуса...</p>
        </div>
      </Card>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <Card style={{ marginTop: '16px' }}>
        <Empty description="Информация о стадиях не найдена" />
      </Card>
    );
  }

  const totalStages = stages.length;
  const completedStages = stages.filter((s) => s.status === 'success').length;
  const progressPercent = (completedStages / totalStages) * 100;

  return (
    <Card style={{ marginTop: '16px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              <strong>Прогресс выполнения</strong>
            </span>
            <span style={{ color: '#666' }}>
              {completedStages} / {totalStages} стадий завершено
            </span>
          </div>
          <Progress
            percent={Math.round(progressPercent)}
            status={isRunning ? 'active' : completedStages === totalStages ? 'success' : 'exception'}
          />
        </div>

        <div>
          <strong style={{ display: 'block', marginBottom: '12px' }}>Стадии выполнения:</strong>
          <Timeline
            items={stages.map((stage, index) => ({
              dot:
                stage.status === 'success' ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                ) : stage.status === 'failed' ? (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
                ) : (
                  <LoadingOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                ),
              children: (
                <div key={index}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>
                      {stage.stage_name === 'source_hunter' && '🔍 Source Hunter'}
                      {stage.stage_name === 'content_fetcher' && '📥 Content Fetcher'}
                      {stage.stage_name === 'document_processor' && '⚙️ Document Processor'}
                      {stage.stage_name === 'dedup' && '🔄 Deduplication'}
                      {stage.stage_name === 'criticality_scorer' && '⭐ Criticality Scorer'}
                      {stage.stage_name === 'event_extractor' && '📊 Event Extractor'}
                    </span>
                    <Tag
                      color={
                        stage.status === 'success'
                          ? 'green'
                          : stage.status === 'failed'
                            ? 'red'
                            : 'processing'
                      }
                    >
                      {stage.status === 'success'
                        ? 'Завершено'
                        : stage.status === 'failed'
                          ? 'Ошибка'
                          : 'В процессе'}
                    </Tag>
                  </div>

                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    {/* Timing */}
                    <div style={{ marginBottom: '4px' }}>
                      ⏱️ {new Date(stage.started_at).toLocaleTimeString('ru-RU')}
                      {stage.completed_at && ` - ${new Date(stage.completed_at).toLocaleTimeString('ru-RU')}`}
                    </div>

                    {/* Duration */}
                    {stage.started_at && stage.completed_at && (
                      <div style={{ marginBottom: '4px', fontStyle: 'italic' }}>
                        Длительность: {((new Date(stage.completed_at).getTime() - new Date(stage.started_at).getTime()) / 1000).toFixed(1)}s
                      </div>
                    )}

                    {/* Results */}
                    {stage.documents_processed !== undefined && stage.documents_processed > 0 && (
                      <div style={{ marginBottom: '4px', fontWeight: 500 }}>
                        ✅ Результат: {stage.stage_name === 'source_hunter' && `Найдено ${stage.documents_processed} источников/документов`}
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
        </div>

        {isRunning && (
          <div style={{ padding: '12px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
            <Spin size="small" style={{ marginRight: '8px' }} />
            <span>Выполнение в процессе...</span>
          </div>
        )}
      </Space>
    </Card>
  );
};
