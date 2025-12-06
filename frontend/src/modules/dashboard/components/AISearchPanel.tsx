/**
 * AISearchPanel Component
 *
 * Панель для запуска AI поиска новостей климатического рынка
 */

import React, { useState } from 'react';
import { Card, Button, Space, InputNumber, Select, Alert, Statistic, Row, Col, Divider, Tag } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import useAISearch from '../hooks/useAISearch';

const SEGMENTS = [
  'кондиционеры',
  'техника',
  'мультизональные_системы',
  'вентиляция',
  'тепловое_оборудование',
  'iot',
  'услуги',
];

const EVENT_TYPES = [
  'акция',
  'цены',
  'условия_оплаты',
  'pr',
  'тендер',
  'соглашение',
  'регулирование',
  'маркетплейс',
];

/**
 * Компонент панели AI поиска
 */
export const AISearchPanel: React.FC = () => {
  const { runSearch, isSearching, isSuccess, isError, error, data, reset } = useAISearch();

  const [days, setDays] = useState<number>(7);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  /**
   * Запустить поиск
   */
  const handleSearch = () => {
    reset(); // Сбросить предыдущий результат

    runSearch({
      days,
      segments: selectedSegments.length > 0 ? selectedSegments : undefined,
      event_types: selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
    });
  };

  return (
    <Card
      title={
        <Space>
          <SearchOutlined />
          <span>AI Поиск Новостей</span>
        </Space>
      }
      bordered={false}
    >
      {/* Настройки поиска */}
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Параметры */}
        <div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Поиск за последние (дней):</strong>
              </div>
              <InputNumber
                min={1}
                max={30}
                value={days}
                onChange={(value) => setDays(value || 7)}
                style={{ width: '100%' }}
                disabled={isSearching}
              />
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Сегменты (опционально):</strong>
              </div>
              <Select
                mode="multiple"
                placeholder="Все сегменты"
                value={selectedSegments}
                onChange={setSelectedSegments}
                options={SEGMENTS.map((s) => ({ label: s, value: s }))}
                style={{ width: '100%' }}
                disabled={isSearching}
                maxTagCount="responsive"
              />
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Типы событий (опционально):</strong>
              </div>
              <Select
                mode="multiple"
                placeholder="Все типы"
                value={selectedEventTypes}
                onChange={setSelectedEventTypes}
                options={EVENT_TYPES.map((t) => ({ label: t, value: t }))}
                style={{ width: '100%' }}
                disabled={isSearching}
                maxTagCount="responsive"
              />
            </Col>
          </Row>
        </div>

        {/* Кнопка запуска */}
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isSearching}
            disabled={isSearching}
          >
            {isSearching ? 'Ищу новости...' : 'Запустить AI Поиск'}
          </Button>
          <div style={{ marginTop: '8px', color: '#8c8c8c', fontSize: '12px' }}>
            OpenAI GPT-4o найдет 5-15 событий из открытых источников
          </div>
        </div>

        {/* Результаты */}
        {isSearching && (
          <Alert
            message="Поиск в процессе..."
            description="AI анализирует источники новостей климатического рынка России. Это может занять 15-30 секунд."
            type="info"
            icon={<ClockCircleOutlined />}
            showIcon
          />
        )}

        {isSuccess && data && (
          <>
            <Divider />
            <Alert
              message="Поиск завершен успешно!"
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    Найдено и сохранено <strong>{data.events_found}</strong> событий за {days} дней
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    ID поиска: {data.search_run_id}
                  </div>
                </Space>
              }
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
            />

            {/* Статистика */}
            <Row gutter={16}>
              <Col xs={12} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Найдено событий"
                    value={data.events_found}
                    valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Время выполнения"
                    value={data.execution_time_seconds}
                    suffix="сек"
                    valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Statistic
                    title="Статус"
                    value="Завершено"
                    valueStyle={{ color: '#52c41a', fontSize: '18px' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Превью событий */}
            {data.events && data.events.length > 0 && (
              <Card size="small" title="Примеры найденных событий (первые 3)">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {data.events.slice(0, 3).map((event, idx) => (
                    <div key={idx} style={{ borderLeft: '3px solid #1890ff', paddingLeft: '12px' }}>
                      <div>
                        <Tag color="blue">{event.event_type}</Tag>
                        <Tag color="green">{event.segment}</Tag>
                        {event.company && <Tag>{event.company}</Tag>}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '14px' }}>
                        <strong>{event.date}</strong> - {event.description}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#8c8c8c' }}>
                        Критичность: {event.criticality}/5
                        {event.geography && ` • ${event.geography}`}
                      </div>
                    </div>
                  ))}
                </Space>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>
                  Все события доступны в разделе "События" →
                </div>
              </Card>
            )}
          </>
        )}

        {isError && (
          <Alert
            message="Ошибка при выполнении поиска"
            description={error?.message || 'Произошла неизвестная ошибка'}
            type="error"
            icon={<CloseCircleOutlined />}
            showIcon
            closable
            onClose={reset}
          />
        )}
      </Space>
    </Card>
  );
};

export default AISearchPanel;
