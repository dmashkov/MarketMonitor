/**
 * BrandsManager - Управление брендами
 *
 * Таблица всех брендов с CRUD операциями (admin only)
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
  GlobalOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useBrands, useDeleteBrand, type BrandFilters } from '../hooks/useBrands';
import type { BrandWithSegments, BrandCategory } from '@/shared/types';
import { BrandFormModal } from './BrandFormModal';

const { Title } = Typography;
const { Search } = Input;

/**
 * Цветовая маппинг для категорий брендов
 */
const categoryColors: Record<BrandCategory, string> = {
  premium: 'gold',
  middle: 'blue',
  budget: 'green',
};

const categoryLabels: Record<BrandCategory, string> = {
  premium: 'Премиум',
  middle: 'Средний',
  budget: 'Бюджет',
};

export const BrandsManager: React.FC = () => {
  // State
  const [filters, setFilters] = useState<BrandFilters>({
    include_segments: true,
    page: 1,
    limit: 50,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandWithSegments | null>(null);

  // Hooks
  const { data, isLoading, refetch } = useBrands(filters);
  const deleteBrandMutation = useDeleteBrand();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  };

  const handleCategoryFilter = (value: BrandCategory | 'all') => {
    setFilters((prev) => ({
      ...prev,
      category: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handleActiveFilter = (value: 'all' | 'active' | 'inactive') => {
    setFilters((prev) => ({
      ...prev,
      is_active: value === 'all' ? undefined : value === 'active',
      page: 1,
    }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, limit: pageSize }));
  };

  const handleCreate = () => {
    setEditingBrand(null);
    setModalOpen(true);
  };

  const handleEdit = (brand: BrandWithSegments) => {
    setEditingBrand(brand);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteBrandMutation.mutateAsync(id);
      message.success(`Бренд "${name}" успешно удален`);
    } catch (error) {
      message.error(`Ошибка при удалении бренда: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingBrand(null);
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setEditingBrand(null);
    refetch();
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<BrandWithSegments> = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (name: string, record) => (
        <Space>
          <strong>{name}</strong>
          {record.logo_url && (
            <img
              src={record.logo_url}
              alt={name}
              style={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          )}
        </Space>
      ),
    },
    {
      title: 'Производитель',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
      width: 150,
      render: (manufacturer: string | null) => manufacturer || '—',
    },
    {
      title: 'Страна',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      render: (country: string | null) => country || '—',
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: [
        { text: 'Премиум', value: 'premium' },
        { text: 'Средний', value: 'middle' },
        { text: 'Бюджет', value: 'budget' },
      ],
      render: (category: BrandCategory) => (
        <Tag color={categoryColors[category]}>
          {categoryLabels[category]}
        </Tag>
      ),
    },
    {
      title: 'Сегменты',
      dataIndex: 'segments',
      key: 'segments',
      width: 250,
      render: (segments: BrandWithSegments['segments']) => (
        <Space size={[0, 4]} wrap>
          {segments && segments.length > 0 ? (
            segments.map((seg) => (
              <Tag key={seg.id} color="blue">
                {seg.code}
              </Tag>
            ))
          ) : (
            <span style={{ color: '#999' }}>Не указаны</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Веб-сайт',
      dataIndex: 'website_url',
      key: 'website_url',
      width: 100,
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
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {is_active ? 'Активен' : 'Неактивен'}
        </Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: BrandWithSegments) => (
        <Space>
          <Tooltip title="Редактировать">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title={`Удалить бренд "${record.name}"?`}
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
                loading={deleteBrandMutation.isPending}
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
            🏷️ Управление брендами
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
              Добавить бренд
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Space size="middle" wrap>
          <Search
            placeholder="Поиск по названию..."
            allowClear
            style={{ width: 250 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />

          <Select
            placeholder="Категория"
            style={{ width: 150 }}
            onChange={handleCategoryFilter}
            allowClear
            defaultValue="all"
          >
            <Select.Option value="all">Все категории</Select.Option>
            <Select.Option value="premium">Премиум</Select.Option>
            <Select.Option value="middle">Средний</Select.Option>
            <Select.Option value="budget">Бюджет</Select.Option>
          </Select>

          <Select
            placeholder="Статус"
            style={{ width: 150 }}
            onChange={handleActiveFilter}
            defaultValue="all"
          >
            <Select.Option value="all">Все</Select.Option>
            <Select.Option value="active">Активные</Select.Option>
            <Select.Option value="inactive">Неактивные</Select.Option>
          </Select>
        </Space>
      </div>

      {/* Table */}
      <Table<BrandWithSegments>
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.limit || 50,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} брендов`,
          pageSizeOptions: ['20', '50', '100'],
          onChange: handlePageChange,
        }}
        scroll={{ x: 1200 }}
        size="middle"
      />

      {/* Form Modal */}
      <BrandFormModal
        open={modalOpen}
        brand={editingBrand}
        onCancel={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </Card>
  );
};

export default BrandsManager;
