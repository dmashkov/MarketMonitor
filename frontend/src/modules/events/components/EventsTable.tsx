/**
 * EventsTable Component
 *
 * Таблица для отображения событий рынка с фильтрацией и сортировкой
 */

import React, { useState } from 'react';
import { Table, Button, Space, Tag, Empty, Spin, Modal, message } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import type { MarketEvent } from '../../../shared/types';
import { useEventsList, useDeleteEvent } from '../hooks/useEvents';

interface EventsTableProps {
  // Reserved for future use
  onEdit?: (event: MarketEvent) => void;
}

/**
 * Компонент таблицы событий
 */
export const EventsTable: React.FC<EventsTableProps> = () => {
  // onEdit reserved for future use
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pagination, setPagination] = useState({ pageSize: 10, current: 1 });

  // Загрузить события
  const { data: events = [], isLoading } = useEventsList({
    limit: pagination.pageSize,
    offset: (pagination.current - 1) * pagination.pageSize,
  });

  // Удалить событие
  const deleteEventMutation = useDeleteEvent();

  const handleDelete = async (event: MarketEvent) => {
    setSelectedEvent(event);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedEvent) return;

    try {
      await deleteEventMutation.mutateAsync(selectedEvent.id);
      message.success('Событие успешно удалено');
      setDeleteModalOpen(false);
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Ошибка при удалении';
      message.error(err);
    }
  };

  const handleViewDetails = (event: MarketEvent) => {
    setSelectedEvent(event);
    setDetailsModalOpen(true);
  };

  const columns: TableProps<MarketEvent>['columns'] = [
    {
      title: 'Дата',
      dataIndex: 'date',
      key: 'date',
      width: '10%',
      render: (date: string) => {
        return new Date(date).toLocaleDateString('ru-RU', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      },
    },
    {
      title: 'Компания',
      dataIndex: 'company',
      key: 'company',
      width: '15%',
      render: (company: string | null) => company || '-',
    },
    {
      title: 'Тип события',
      dataIndex: 'event_type',
      key: 'event_type',
      width: '12%',
      render: (eventType: string) => (
        <Tag color="blue">{eventType}</Tag>
      ),
    },
    {
      title: 'Сегмент',
      dataIndex: 'segment',
      key: 'segment',
      width: '12%',
      render: (segment: string) => (
        <Tag color="green">{segment}</Tag>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: '25%',
      ellipsis: true,
    },
    {
      title: 'Критичность',
      dataIndex: 'criticality',
      key: 'criticality',
      width: '10%',
      render: (criticality: number) => (
        <Tag color={criticality >= 4 ? 'red' : criticality >= 3 ? 'orange' : 'default'}>
          {criticality}/5
        </Tag>
      ),
    },
    {
      title: 'Источник',
      dataIndex: 'source_url',
      key: 'source_url',
      width: '10%',
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            📎 Открыть
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: '15%',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            Просмотр
          </Button>
          <Button
            type="primary"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Spin spinning={isLoading}>
        {events.length === 0 ? (
          <Empty description="Нет событий" />
        ) : (
          <Table<MarketEvent>
            columns={columns}
            dataSource={events}
            rowKey="id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: events.length,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize });
              },
            }}
            loading={isLoading}
          />
        )}
      </Spin>

      {/* Модальное окно с деталями события */}
      <Modal
        title="Детали события"
        open={detailsModalOpen}
        onCancel={() => setDetailsModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedEvent && (
          <div>
            <p>
              <strong>Компания:</strong> {selectedEvent.company || 'Не указана'}
            </p>
            <p>
              <strong>Тип события:</strong> <Tag color="blue">{selectedEvent.event_type}</Tag>
            </p>
            <p>
              <strong>Дата:</strong> {new Date(selectedEvent.date).toLocaleDateString('ru-RU')}
            </p>
            <p>
              <strong>Описание:</strong>
            </p>
            <p>{selectedEvent.description}</p>
            {selectedEvent.source_url && (
              <p>
                <strong>Ссылка:</strong>{' '}
                <a href={selectedEvent.source_url} target="_blank" rel="noopener noreferrer">
                  {selectedEvent.source_url}
                </a>
              </p>
            )}
            <p>
              <strong>Дата создания:</strong>{' '}
              {new Date(selectedEvent.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
        )}
      </Modal>

      {/* Модальное окно подтверждения удаления */}
      <Modal
        title="Подтверждение удаления"
        open={deleteModalOpen}
        onOk={confirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
        confirmLoading={deleteEventMutation.isPending}
        okText="Удалить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <p>Вы уверены, что хотите удалить это событие?</p>
        <p>
          <strong>{selectedEvent?.company || selectedEvent?.description.substring(0, 50)}</strong>
        </p>
      </Modal>
    </>
  );
};

export default EventsTable;
