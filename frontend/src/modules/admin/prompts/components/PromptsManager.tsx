/**
 * PromptsManager - Управление AI промптами
 *
 * Таблица всех промптов с CRUD операциями
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
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { usePrompts, useDeletePrompt, type PromptFilters } from '../hooks/usePrompts';
import type { AIPromptWithRelations, SearchType } from '@/shared/types';
import { PromptFormModal } from './PromptFormModal';

const { Title, Text } = Typography;
const { Search } = Input;

/**
 * Цвета для типов поиска
 */
const searchTypeColors: Record<SearchType, string> = {
  marketing: 'blue',
  pricing: 'green',
  regulations: 'orange',
  partnerships: 'purple',
  auctions: 'red',
  general: 'default',
};

const searchTypeLabels: Record<SearchType, string> = {
  marketing: 'Маркетинг',
  pricing: 'Цены',
  regulations: 'Регулирование',
  partnerships: 'Партнерства',
  auctions: 'Аукционы',
  general: 'Общий',
};

export const PromptsManager: React.FC = () => {
  // State
  const [filters, setFilters] = useState<PromptFilters>({
    page: 1,
    limit: 50,
  });

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPromptWithRelations | null>(null);

  // Hooks
  const { data, isLoading, refetch } = usePrompts(filters);
  const deletePromptMutation = useDeletePrompt();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  };

  const handleSearchTypeFilter = (value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      searchType: value as SearchType | undefined,
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

  const handleAddPrompt = () => {
    setEditingPrompt(null);
    setFormModalOpen(true);
  };

  const handleEditPrompt = (prompt: AIPromptWithRelations) => {
    setEditingPrompt(prompt);
    setFormModalOpen(true);
  };

  const handleDeletePrompt = (id: string) => {
    deletePromptMutation.mutate(id, {
      onSuccess: () => {
        message.success('Промпт удален');
        refetch();
      },
      onError: (error) => {
        message.error(`Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
      },
    });
  };

  const handleCloseModal = () => {
    setFormModalOpen(false);
    setEditingPrompt(null);
  };

  const handleFormSuccess = () => {
    handleCloseModal();
    refetch();
    message.success(editingPrompt ? 'Промпт обновлен' : 'Промпт создан');
  };

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnsType<AIPromptWithRelations> = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (name: string, record) => (
        <Tooltip title={record.description || 'Нет описания'}>
          <div>
            <Text strong>{name}</Text>
            {record.description && (
              <div style={{ fontSize: 12, color: '#999' }}>
                {record.description.substring(0, 80)}
                {record.description.length > 80 && '...'}
              </div>
            )}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Тип поиска',
      dataIndex: 'search_type',
      key: 'search_type',
      width: '15%',
      render: (searchType: SearchType | null) => {
        if (!searchType) return <Text type="secondary">—</Text>;
        return (
          <Tag color={searchTypeColors[searchType]}>
            {searchTypeLabels[searchType]}
          </Tag>
        );
      },
    },
    {
      title: 'Частота',
      dataIndex: 'search_depth',
      key: 'search_depth',
      width: '12%',
      render: (depth: string) => {
        const depthMap: Record<string, string> = {
          daily: 'Ежедневно',
          weekly: 'Еженедельно',
          monthly: 'Ежемесячно',
        };
        return <Text>{depthMap[depth] || depth}</Text>;
      },
    },
    {
      title: 'Сегмент',
      dataIndex: ['segment', 'name'],
      key: 'segment',
      width: '15%',
      render: (segmentName: string | undefined) => {
        return <Text>{segmentName || '—'}</Text>;
      },
    },
    {
      title: 'География',
      dataIndex: ['geography', 'name'],
      key: 'geography',
      width: '15%',
      render: (geographyName: string | undefined) => {
        return <Text>{geographyName || '—'}</Text>;
      },
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: '10%',
      render: (isActive: boolean) =>
        isActive ? (
          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
        ) : (
          <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 16 }} />
        ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: '8%',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditPrompt(record)}
            title="Редактировать"
          />
          <Popconfirm
            title="Удалить промпт?"
            description={`Вы уверены, что хотите удалить промпт "${record.name}"?`}
            onConfirm={() => handleDeletePrompt(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletePromptMutation.isPending}
              title="Удалить"
            />
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
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Title level={3} style={{ margin: 0 }}>
            Управление AI Промптами
          </Title>
          <Space style={{ width: '100%' }}>
            <Search
              placeholder="Поиск промптов..."
              allowClear
              onSearch={handleSearch}
              style={{ width: 250 }}
            />
            <Select
              placeholder="Тип поиска"
              allowClear
              onChange={handleSearchTypeFilter}
              style={{ width: 150 }}
              options={[
                { label: 'Маркетинг', value: 'marketing' },
                { label: 'Цены', value: 'pricing' },
                { label: 'Регулирование', value: 'regulations' },
                { label: 'Партнерства', value: 'partnerships' },
                { label: 'Аукционы', value: 'auctions' },
                { label: 'Общий', value: 'general' },
              ]}
            />
            <Select
              placeholder="Статус"
              allowClear
              onChange={handleActiveFilter}
              style={{ width: 120 }}
              options={[
                { label: 'Активные', value: 'true' },
                { label: 'Неактивные', value: 'false' },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddPrompt}
            >
              Новый промпт
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            />
          </Space>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={data?.data?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: data?.data?.page || 1,
            pageSize: data?.data?.page_size || 50,
            total: data?.data?.total || 0,
            onChange: (page) => {
              setFilters((prev) => ({ ...prev, page }));
            },
          }}
          size="small"
        />
      </Space>

      {/* Form Modal */}
      <PromptFormModal
        open={formModalOpen}
        onClose={handleCloseModal}
        prompt={editingPrompt}
        onSuccess={handleFormSuccess}
      />
    </Card>
  );
};
