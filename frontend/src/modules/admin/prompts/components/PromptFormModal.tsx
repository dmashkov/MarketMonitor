/**
 * PromptFormModal - Форма для создания/редактирования промпта
 */

import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Row, Col, message, Spin } from 'antd';
import { useCreatePrompt, useUpdatePrompt } from '../hooks/usePrompts';
import type { AIPromptWithRelations, SearchType, SearchDepth } from '@/shared/types';
import { useSegments } from '@/modules/admin/segments';
import { useGeographies } from '@/shared/hooks';

interface PromptFormModalProps {
  open: boolean;
  onClose: () => void;
  prompt?: AIPromptWithRelations | null;
  onSuccess: () => void;
}

const searchTypeOptions = [
  { label: 'Маркетинг', value: 'marketing' },
  { label: 'Цены', value: 'pricing' },
  { label: 'Регулирование', value: 'regulations' },
  { label: 'Партнерства', value: 'partnerships' },
  { label: 'Аукционы', value: 'auctions' },
  { label: 'Общий поиск', value: 'general' },
];

const searchDepthOptions = [
  { label: 'Ежедневно', value: 'daily' },
  { label: 'Еженедельно', value: 'weekly' },
  { label: 'Ежемесячно', value: 'monthly' },
];

export const PromptFormModal: React.FC<PromptFormModalProps> = ({
  open,
  onClose,
  prompt,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const createMutation = useCreatePrompt();
  const updateMutation = useUpdatePrompt();
  const { data: segmentsData, isLoading: segmentsLoading } = useSegments();
  const { data: geographiesData, isLoading: geographiesLoading } = useGeographies();

  const isLoading = segmentsLoading || geographiesLoading;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (open) {
      if (prompt) {
        // Edit mode - populate form with existing data
        form.setFieldsValue({
          name: prompt.name,
          description: prompt.description,
          prompt_template: prompt.prompt_template,
          search_type: prompt.search_type,
          search_depth: prompt.search_depth,
          segment_id: prompt.segment_id,
          geography_id: prompt.geography_id,
          is_active: prompt.is_active,
        });
      } else {
        // Create mode - reset form
        form.resetFields();
        form.setFieldsValue({
          is_active: true,
          search_depth: 'daily',
        });
      }
    }
  }, [open, prompt, form]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      if (prompt) {
        // Update
        await updateMutation.mutateAsync({
          id: prompt.id,
          data: {
            name: values.name as string,
            description: (values.description as string) || null,
            prompt_template: values.prompt_template as string,
            search_type: (values.search_type as SearchType) || null,
            search_depth: values.search_depth as SearchDepth,
            segment_id: (values.segment_id as string) || null,
            geography_id: (values.geography_id as string) || null,
            is_active: values.is_active as boolean,
          },
        });
      } else {
        // Create
        await createMutation.mutateAsync({
          name: values.name as string,
          description: (values.description as string) || null,
          prompt_template: values.prompt_template as string,
          search_type: (values.search_type as SearchType) || null,
          search_depth: values.search_depth as SearchDepth,
          segment_id: (values.segment_id as string) || null,
          geography_id: (values.geography_id as string) || null,
          is_active: values.is_active as boolean,
        });
      }
      onSuccess();
    } catch (error) {
      message.error(
        `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
      );
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Modal
      title={prompt ? 'Редактировать промпт' : 'Новый промпт'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      width={800}
      okText="Сохранить"
      cancelText="Отмена"
    >
      <Spin spinning={isLoading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          {/* Name */}
          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: 'Введите название промпта' }]}
          >
            <Input placeholder="e.g., Daily Market Search - RAC" />
          </Form.Item>

          {/* Description */}
          <Form.Item label="Описание" name="description">
            <Input.TextArea
              rows={2}
              placeholder="Краткое описание назначения промпта"
            />
          </Form.Item>

          {/* Prompt Template */}
          <Form.Item
            label="Шаблон промпта"
            name="prompt_template"
            rules={[{ required: true, message: 'Введите шаблон промпта' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder={`e.g., Найти события на рынке кондиционеров в России за последние {date_range_days} дней.
Искать: новости о компаниях {brands}, акции, цены, партнерства.
Формат ответа: JSON массив событий с полями (date, company, event_type, description, criticality).`}
            />
          </Form.Item>

          {/* Search Type and Depth */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Тип поиска" name="search_type">
                <Select
                  placeholder="Выберите тип поиска"
                  options={searchTypeOptions}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Частота поиска"
                name="search_depth"
                rules={[{ required: true, message: 'Выберите частоту' }]}
              >
                <Select
                  placeholder="Выберите частоту"
                  options={searchDepthOptions}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Segment and Geography */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Сегмент" name="segment_id">
                <Select
                  placeholder="Выберите сегмент (опционально)"
                  options={
                    segmentsData?.data?.map((segment) => ({
                      label: segment.name,
                      value: segment.id,
                    })) || []
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="География" name="geography_id">
                <Select
                  placeholder="Выберите географию (опционально)"
                  options={
                    geographiesData?.map((geo) => ({
                      label: geo.name,
                      value: geo.id,
                    })) || []
                  }
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Is Active */}
          <Form.Item label="Активен" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
};
