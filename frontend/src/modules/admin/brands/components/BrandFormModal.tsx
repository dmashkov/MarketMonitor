/**
 * BrandFormModal - Модальная форма для создания/редактирования бренда
 *
 * Features:
 * - Валидация через react-hook-form
 * - Multi-select для сегментов
 * - Support для создания и редактирования
 */

import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message, Row, Col } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { useCreateBrand, useUpdateBrand } from '../hooks/useBrands';
import { useSegments } from '@/modules/admin/segments/hooks/useSegments';
import type { BrandWithSegments, BrandCategory, CreateBrandFormData } from '@/shared/types';

const { TextArea } = Input;

interface BrandFormModalProps {
  open: boolean;
  brand: BrandWithSegments | null; // null = создание, объект = редактирование
  onCancel: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  manufacturer?: string;
  country?: string;
  category: BrandCategory;
  website_url?: string;
  logo_url?: string;
  description?: string;
  is_active: boolean;
  segment_ids: string[];
}

export const BrandFormModal: React.FC<BrandFormModalProps> = ({
  open,
  brand,
  onCancel,
  onSuccess,
}) => {
  // Hooks
  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const { data: segmentsData, isLoading: segmentsLoading } = useSegments();

  const isEdit = !!brand;

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      manufacturer: '',
      country: '',
      category: 'middle',
      website_url: '',
      logo_url: '',
      description: '',
      is_active: true,
      segment_ids: [],
    },
  });

  // Сбросить форму при открытии/закрытии модалки
  useEffect(() => {
    if (open && brand) {
      // Редактирование: заполняем форму данными
      reset({
        name: brand.name,
        manufacturer: brand.manufacturer || '',
        country: brand.country || '',
        category: brand.category,
        website_url: brand.website_url || '',
        logo_url: brand.logo_url || '',
        description: brand.description || '',
        is_active: brand.is_active,
        segment_ids: brand.segments?.map((s) => s.id) || [],
      });
    } else if (open && !brand) {
      // Создание: сбрасываем форму
      reset({
        name: '',
        manufacturer: '',
        country: '',
        category: 'middle',
        website_url: '',
        logo_url: '',
        description: '',
        is_active: true,
        segment_ids: [],
      });
    }
  }, [open, brand, reset]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit) {
        // Обновление
        await updateMutation.mutateAsync({
          id: brand.id,
          ...values,
        });
        message.success(`Бренд "${values.name}" успешно обновлен`);
      } else {
        // Создание
        await createMutation.mutateAsync(values as CreateBrandFormData);
        message.success(`Бренд "${values.name}" успешно создан`);
      }
      onSuccess();
    } catch (error) {
      message.error(
        `Ошибка при ${isEdit ? 'обновлении' : 'создании'} бренда: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  // ============================================================================
  // Render
  // ============================================================================

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={isEdit ? `✏️ Редактировать бренд: ${brand?.name}` : '➕ Добавить новый бренд'}
      open={open}
      onOk={handleSubmit(onSubmit)}
      onCancel={handleCancel}
      okText={isEdit ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      confirmLoading={isLoading}
      width={700}
      destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          {/* Название */}
          <Col span={12}>
            <Form.Item
              label="Название бренда"
              required
              validateStatus={errors.name ? 'error' : ''}
              help={errors.name?.message}
            >
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Название обязательно' }}
                render={({ field }) => (
                  <Input {...field} placeholder="Например: Daikin" />
                )}
              />
            </Form.Item>
          </Col>

          {/* Категория */}
          <Col span={12}>
            <Form.Item
              label="Категория"
              required
              validateStatus={errors.category ? 'error' : ''}
              help={errors.category?.message}
            >
              <Controller
                name="category"
                control={control}
                rules={{ required: 'Выберите категорию' }}
                render={({ field }) => (
                  <Select {...field} placeholder="Выберите категорию">
                    <Select.Option value="premium">Премиум</Select.Option>
                    <Select.Option value="middle">Средний</Select.Option>
                    <Select.Option value="budget">Бюджет</Select.Option>
                  </Select>
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          {/* Производитель */}
          <Col span={12}>
            <Form.Item label="Производитель">
              <Controller
                name="manufacturer"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Например: Daikin Industries" />
                )}
              />
            </Form.Item>
          </Col>

          {/* Страна */}
          <Col span={12}>
            <Form.Item label="Страна">
              <Controller
                name="country"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder="Например: Япония" />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Сегменты (Multi-select) */}
        <Form.Item label="Сегменты оборудования">
          <Controller
            name="segment_ids"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                mode="multiple"
                placeholder="Выберите сегменты (можно несколько)"
                loading={segmentsLoading}
                disabled={segmentsLoading}
                style={{ width: '100%' }}
              >
                {segmentsData?.data?.map((segment) => (
                  <Select.Option key={segment.id} value={segment.id}>
                    {segment.code} - {segment.name}
                  </Select.Option>
                ))}
              </Select>
            )}
          />
        </Form.Item>

        {/* Веб-сайт */}
        <Form.Item label="Веб-сайт">
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
              <Input {...field} placeholder="https://www.daikin.com" />
            )}
          />
          {errors.website_url && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
              {errors.website_url.message}
            </div>
          )}
        </Form.Item>

        {/* URL логотипа */}
        <Form.Item label="URL логотипа">
          <Controller
            name="logo_url"
            control={control}
            rules={{
              pattern: {
                value: /^https?:\/\/.+/,
                message: 'URL должен начинаться с http:// или https://',
              },
            }}
            render={({ field }) => (
              <Input {...field} placeholder="https://example.com/logo.png" />
            )}
          />
          {errors.logo_url && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
              {errors.logo_url.message}
            </div>
          )}
        </Form.Item>

        {/* Описание */}
        <Form.Item label="Описание">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={3}
                placeholder="Краткое описание бренда..."
              />
            )}
          />
        </Form.Item>

        {/* Активен */}
        <Form.Item label="Статус">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <Switch
                {...field}
                checked={field.value}
                checkedChildren="Активен"
                unCheckedChildren="Неактивен"
              />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BrandFormModal;
