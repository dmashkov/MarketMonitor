/**
 * UsersManager - Управление пользователями
 *
 * Таблица всех пользователей с возможностью редактирования (admin only)
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
  Modal,
  Form,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  LockOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useUsers,
  useUpdateUser,
  useDeleteUser,
  type UserProfile,
  type UserFilters,
  type UserRole,
} from '../hooks/useUsers';

const { Title } = Typography;
const { Search } = Input;

/**
 * Маппинг ролей
 */
const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  user: 'Пользователь',
};

const roleColors: Record<UserRole, string> = {
  admin: 'red',
  user: 'blue',
};

export const UsersManager: React.FC = () => {
  // State
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 50,
  });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form] = Form.useForm();

  // Hooks
  const { data, isLoading, refetch } = useUsers(filters);
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  };

  const handleRoleFilter = (value: UserRole | 'all') => {
    setFilters((prev) => ({
      ...prev,
      role: value === 'all' ? undefined : value,
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

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    form.setFieldsValue({
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await form.validateFields();
      await updateUserMutation.mutateAsync({
        id: editingUser!.id,
        ...values,
      });
      message.success(`Пользователь "${editingUser!.email}" обновлен`);
      setEditModalOpen(false);
      setEditingUser(null);
      form.resetFields();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    try {
      await deleteUserMutation.mutateAsync(id);
      message.success(`Пользователь "${email}" деактивирован`);
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<UserProfile> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 250,
      fixed: 'left',
      render: (email: string) => (
        <Space>
          <UserOutlined />
          <strong>{email}</strong>
        </Space>
      ),
    },
    {
      title: 'Имя',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      render: (name: string | null) => name || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 150,
      filters: [
        { text: 'Администратор', value: 'admin' },
        { text: 'Пользователь', value: 'user' },
      ],
      render: (role: UserRole) => (
        <Tag color={roleColors[role]} icon={role === 'admin' ? <LockOutlined /> : <UserOutlined />}>
          {roleLabels[role]}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      align: 'center',
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {is_active ? 'Активен' : 'Деактивирован'}
        </Tag>
      ),
    },
    {
      title: 'Дата регистрации',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: UserProfile) => (
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
            title={`Деактивировать пользователя "${record.email}"?`}
            description="Пользователь не сможет войти в систему"
            onConfirm={() => handleDelete(record.id, record.email)}
            okText="Деактивировать"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Деактивировать">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={deleteUserMutation.isPending}
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
            👥 Управление пользователями
          </Title>
          <Tooltip title="Обновить">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          </Tooltip>
        </div>

        {/* Filters */}
        <Space size="middle" wrap>
          <Search
            placeholder="Поиск по email или имени..."
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />

          <Select
            placeholder="Роль"
            style={{ width: 180 }}
            onChange={handleRoleFilter}
            allowClear
            defaultValue="all"
          >
            <Select.Option value="all">Все роли</Select.Option>
            <Select.Option value="admin">Администратор</Select.Option>
            <Select.Option value="user">Пользователь</Select.Option>
          </Select>

          <Select
            placeholder="Статус"
            style={{ width: 180 }}
            onChange={handleActiveFilter}
            defaultValue="all"
          >
            <Select.Option value="all">Все</Select.Option>
            <Select.Option value="active">Активные</Select.Option>
            <Select.Option value="inactive">Деактивированные</Select.Option>
          </Select>
        </Space>
      </div>

      {/* Table */}
      <Table<UserProfile>
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.limit || 50,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} пользователей`,
          pageSizeOptions: ['20', '50', '100'],
          onChange: handlePageChange,
        }}
        scroll={{ x: 1200 }}
        size="middle"
      />

      {/* Edit Modal */}
      <Modal
        title={`Редактировать пользователя: ${editingUser?.email}`}
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={handleModalClose}
        confirmLoading={updateUserMutation.isPending}
        okText="Сохранить"
        cancelText="Отмена"
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label="Полное имя"
            name="full_name"
          >
            <Input placeholder="Введите полное имя" />
          </Form.Item>

          <Form.Item
            label="Роль"
            name="role"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select>
              <Select.Option value="user">Пользователь</Select.Option>
              <Select.Option value="admin">Администратор</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Статус"
            name="is_active"
            rules={[{ required: true, message: 'Выберите статус' }]}
          >
            <Select>
              <Select.Option value={true}>Активен</Select.Option>
              <Select.Option value={false}>Деактивирован</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UsersManager;
