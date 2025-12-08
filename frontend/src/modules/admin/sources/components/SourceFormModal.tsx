/**
 * SourceFormModal - Форма создания/редактирования источника
 *
 * Поддерживает два режима:
 * - Create: создание нового источника
 * - Edit: редактирование существующего источника
 */

import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch, Space, Typography } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { useCreateSource, useUpdateSource, type CreateSourceFormData } from '../hooks/useSources';
import { useSourceTypes } from '../hooks/useSourceTypes';
import type { SourceWithType, CheckFrequency } from '@/shared/types';

const { TextArea } = Input;
const { Text } = Typography;

interface SourceFormModalProps {
  open: boolean;
  source?: SourceWithType | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  source_type_id: string;
  website_url?: string;
  telegram_channel?: string;
  description?: string;
  is_active: boolean;
  priority: number;
  check_frequency: CheckFrequency;
}

export const SourceFormModal: React.FC<SourceFormModalProps> = ({
  open,
  source,
  onCancel,
  onSuccess,
}) => {
  const isEditMode = !!source;

  const createMutation = useCreateSource();
  const updateMutation = useUpdateSource();
  const { data: sourceTypes, isLoading: typesLoading } = useSourceTypes();

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      source_type_id: '',
      website_url: '',
      telegram_channel: '',
      description: '',
      is_active: true,
      priority: 5,
      check_frequency: 'weekly',
    },
  });

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (source) {
      // Populate form with existing source data
      reset({
        name: source.name,
        source_type_id: source.source_type_id,
        website_url: source.website_url || '',
        telegram_channel: source.telegram_channel || '',
        description: source.description || '',
        is_active: source.is_active,
        priority: source.priority,
        check_frequency: source.check_frequency,
      });
    } else {
      // Reset to default values for create mode
      reset({
        name: '',
        source_type_id: '',
        website_url: '',
        telegram_channel: '',
        description: '',
        is_active: true,
        priority: 5,
        check_frequency: 'weekly',
      });
    }
  }, [source, reset]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const formData: CreateSourceFormData = {
        name: values.name,
        source_type_id: values.source_type_id,
        website_url: values.website_url || null,
        telegram_channel: values.telegram_channel || null,
        description: values.description || null,
        is_active: values.is_active,
        priority: values.priority,
        check_frequency: values.check_frequency,
        metadata: {},
      };

      if (isEditMode && source) {
        await updateMutation.mutateAsync({ id: source.id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }

      onSuccess();
      reset();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={isEditMode ? `✏️ Редактировать источник` : `➕ Создать источник`}
      open={open}
      onOk={handleSubmit(onSubmit)}
      onCancel={handleCancel}
      okText={isEditMode ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      confirmLoading={isLoading}
      width={700}
      destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 24 }}>
        {/* Name */}
        <Form.Item
          label="Название источника"
          required
          validateStatus={errors.name ? 'error' : ''}
          help={errors.name?.message}
        >
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Название обязательно' }}
            render={({ field }) => (
              <Input {...field} placeholder="Например: Русклимат, MIDEA Russia" />
            )}
          />
        </Form.Item>

        {/* Source Type */}
        <Form.Item
          label="Тип источника"
          required
          validateStatus={errors.source_type_id ? 'error' : ''}
          help={errors.source_type_id?.message}
        >
          <Controller
            name="source_type_id"
            control={control}
            rules={{ required: 'Выберите тип' }}
            render={({ field }) => (
              <Select
                {...field}
                placeholder="Выберите тип источника"
                loading={typesLoading}
              >
                {sourceTypes?.map((type) => (
                  <Select.Option key={type.id} value={type.id}>
                    {type.name}
                    {type.description && (
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                        ({type.description})
                      </Text>
                    )}
                  </Select.Option>
                ))}
              </Select>
            )}
          />
        </Form.Item>

        {/* Website URL */}
        <Form.Item
          label="URL сайта"
          validateStatus={errors.website_url ? 'error' : ''}
          help={errors.website_url?.message}
        >
          <Controller
            name="website_url"
            control={control}
            rules={{
              pattern: {
                value: /^https?:\/\/.+/,
                message: 'URL должен начинаться с http:// или https://',
              },
            }}
            render={({ field }) => (
              <Input {...field} placeholder="https://example.com" />
            )}
          />
        </Form.Item>

        {/* Telegram Channel */}
        <Form.Item
          label="Telegram канал"
          help="Укажите username канала (с @ или без)"
        >
          <Controller
            name="telegram_channel"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="@channelname или channelname" />
            )}
          />
        </Form.Item>

        {/* Description */}
        <Form.Item label="Описание">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={3}
                placeholder="Краткое описание источника..."
              />
            )}
          />
        </Form.Item>

        {/* Priority and Frequency Row */}
        <Space size="large" style={{ width: '100%' }}>
          {/* Priority */}
          <Form.Item
            label="Приоритет (1-10)"
            required
            validateStatus={errors.priority ? 'error' : ''}
            help={errors.priority?.message}
            style={{ flex: 1 }}
          >
            <Controller
              name="priority"
              control={control}
              rules={{
                required: 'Приоритет обязателен',
                min: { value: 1, message: 'Минимум 1' },
                max: { value: 10, message: 'Максимум 10' },
              }}
              render={({ field }) => (
                <InputNumber
                  {...field}
                  min={1}
                  max={10}
                  style={{ width: '100%' }}
                  placeholder="5"
                />
              )}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              1 = низкий, 10 = критичный
            </Text>
          </Form.Item>

          {/* Check Frequency */}
          <Form.Item
            label="Частота проверки"
            required
            validateStatus={errors.check_frequency ? 'error' : ''}
            help={errors.check_frequency?.message}
            style={{ flex: 1 }}
          >
            <Controller
              name="check_frequency"
              control={control}
              rules={{ required: 'Выберите частоту' }}
              render={({ field }) => (
                <Select {...field} placeholder="Выберите частоту">
                  <Select.Option value="daily">Ежедневно</Select.Option>
                  <Select.Option value="weekly">Еженедельно</Select.Option>
                  <Select.Option value="monthly">Ежемесячно</Select.Option>
                </Select>
              )}
            />
          </Form.Item>
        </Space>

        {/* Is Active */}
        <Form.Item label="Статус">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Space>
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  checkedChildren="Активен"
                  unCheckedChildren="Неактивен"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {field.value
                    ? 'Источник будет включен в мониторинг'
                    : 'Источник не будет проверяться'}
                </Text>
              </Space>
            )}
          />
        </Form.Item>

        {/* Info */}
        {!isEditMode && (
          <div style={{ padding: 12, background: '#f0f2f5', borderRadius: 4, marginTop: 16 }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ℹ️ <strong>После создания источника:</strong>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                • Источник появится в общем списке
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                • Вы сможете добавить конкретные URL для мониторинга
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                • AI агенты начнут собирать данные согласно частоте проверки
              </Text>
            </Space>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default SourceFormModal;
