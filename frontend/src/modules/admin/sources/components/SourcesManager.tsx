/**
 * SourcesManager - Управление источниками мониторинга
 *
 * Таблица всех источников с фильтрами и CRUD операциями
 */

import React, { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Typography,
  Card,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useSources, useDeleteSource, type SourceFilters } from '../hooks/useSources';
import { useSourceTypes } from '../hooks/useSourceTypes';
import type { SourceWithType, CheckFrequency } from '@/shared/types';
import { SourceFormModal } from './SourceFormModal';

const { Title, Text } = Typography;
const { Search } = Input;

/**
 * Цвета для частоты проверки
 */
const frequencyColors: Record<CheckFrequency, string> = {
  daily: 'blue',
  weekly: 'green',
  monthly: 'orange',
};

const frequencyLabels: Record<CheckFrequency, string> = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
};

/**
 * Цвета для приоритета
 */
function getPriorityColor(priority: number): string {
  if (priority >= 8) return 'red'; // Высокий
  if (priority >= 5) return 'orange'; // Средний
  return 'default'; // Низкий
}

export const SourcesManager: React.FC = () => {
  // State
  const [filters, setFilters] = useState<SourceFilters>({
    page: 1,
    limit: 50,
  });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceWithType | null>(null);

  // Hooks
  const { data, isLoading, refetch } = useSources(filters);
  const { data: sourceTypes } = useSourceTypes();
  const deleteSourceMutation = useDeleteSource();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  };

  const handleTypeFilter = (value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      type: value,
      page: 1,
    }));
  };

  const handleActiveFilter = (value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      active: value === 'true' ? true : value === 'false' ? false : undefined,
      page: 1,
    }));
  };

  const handleFrequencyFilter = (value: CheckFrequency | undefined) => {
    setFilters((prev) => ({
      ...prev,
      frequency: value,
      page: 1,
    }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, limit: pageSize }));
  };

  const handleCreate = () => {
    setEditingSource(null);
    setFormModalOpen(true);
  };

  const handleEdit = (source: SourceWithType) => {
    setEditingSource(source);
    setFormModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteSourceMutation.mutateAsync(id);
      message.success(`Источник "${name}" успешно удален`);
    } catch (error) {
      message.error(`Ошибка при удалении: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFormModalClose = () => {
    setFormModalOpen(false);
    setEditingSource(null);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingSource(null);
    refetch();
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<SourceWithType> = [
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      align: 'center',
      render: (isActive: boolean) =>
        isActive ? (
          <Tooltip title="Активен">
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          </Tooltip>
        ) : (
          <Tooltip title="Неактивен">
            <CloseCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />
          </Tooltip>
        ),
      filters: [
        { text: 'Активен', value: true },
        { text: 'Неактивен', value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true,
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description.substring(0, 80)}
              {record.description.length > 80 && '...'}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 150,
      render: (sourceType?: SourceWithType['source_type']) =>
        sourceType ? <Tag color="blue">{sourceType.name}</Tag> : '—',
      filters: sourceTypes?.map((type) => ({ text: type.name, value: type.id })),
      onFilter: (value, record) => record.source_type_id === value,
    },
    {
      title: 'Сайт',
      dataIndex: 'website_url',
      key: 'website_url',
      width: 80,
      align: 'center',
      render: (url: string | null) =>
        url ? (
          <Tooltip title={url}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <GlobalOutlined style={{ fontSize: 18 }} />
            </a>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      title: 'Telegram',
      dataIndex: 'telegram_channel',
      key: 'telegram_channel',
      width: 100,
      align: 'center',
      render: (channel: string | null) =>
        channel ? (
          <Tooltip title={channel}>
            <a href={`https://t.me/${channel.replace('@', '')}`} target="_blank" rel="noopener noreferrer">
              <SendOutlined style={{ fontSize: 18, color: '#1890ff' }} />
            </a>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      align: 'center',
      render: (priority: number) => (
        <Tag color={getPriorityColor(priority)}>{priority}/10</Tag>
      ),
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: 'Частота',
      dataIndex: 'check_frequency',
      key: 'check_frequency',
      width: 130,
      render: (frequency: CheckFrequency) => (
        <Tag color={frequencyColors[frequency]}>{frequencyLabels[frequency]}</Tag>
      ),
      filters: [
        { text: 'Ежедневно', value: 'daily' },
        { text: 'Еженедельно', value: 'weekly' },
        { text: 'Ежемесячно', value: 'monthly' },
      ],
      onFilter: (value, record) => record.check_frequency === value,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: SourceWithType) => (
        <Space size="small">
          <Tooltip title="Редактировать">
            <Button
              type="link"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={`Удалить источник "${record.name}"?`}
            description="Это действие нельзя отменить"
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Удалить">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={deleteSourceMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>
            📰 Управление источниками
          </Title>
          <Space>
            <Tooltip title="Обновить">
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Добавить источник
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Space size="middle" wrap>
          <Search
            placeholder="Поиск по названию..."
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />

          <Select
            placeholder="Тип источника"
            style={{ width: 200 }}
            onChange={handleTypeFilter}
            allowClear
          >
            {sourceTypes?.map((type) => (
              <Select.Option key={type.id} value={type.id}>
                {type.name}
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Активность"
            style={{ width: 150 }}
            onChange={handleActiveFilter}
            allowClear
          >
            <Select.Option value="true">Активен</Select.Option>
            <Select.Option value="false">Неактивен</Select.Option>
          </Select>

          <Select
            placeholder="Частота"
            style={{ width: 180 }}
            onChange={handleFrequencyFilter}
            allowClear
          >
            <Select.Option value="daily">Ежедневно</Select.Option>
            <Select.Option value="weekly">Еженедельно</Select.Option>
            <Select.Option value="monthly">Ежемесячно</Select.Option>
          </Select>
        </Space>
      </div>

      {/* Table */}
      <Table<SourceWithType>
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.page_size || 50,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} источников`,
          pageSizeOptions: ['20', '50', '100'],
          onChange: handlePageChange,
        }}
        scroll={{ x: 1200 }}
        size="middle"
      />

      {/* Form Modal */}
      <SourceFormModal
        open={formModalOpen}
        source={editingSource}
        onCancel={handleFormModalClose}
        onSuccess={handleFormSuccess}
      />
    </Card>
  );
};

export default SourcesManager;
