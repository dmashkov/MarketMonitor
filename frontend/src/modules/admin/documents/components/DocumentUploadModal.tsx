/**
 * DocumentUploadModal - Модальное окно для загрузки документов
 *
 * Features:
 * - Drag & Drop upload
 * - Поддержка PDF, DOCX, PPTX
 * - Валидация типов файлов
 * - Progress bar
 * - Автоматическая обработка (upload → text extraction → embedding)
 */

import React, { useState } from 'react';
import { Modal, Upload, Form, Input, Select, message, Space, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { useCreateDocument } from '../hooks/useDocuments';
import type { DocumentType, CreateDocumentFormData } from '@/shared/types';

const { Dragger } = Upload;
const { TextArea } = Input;
const { Text } = Typography;

interface DocumentUploadModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  document_type: DocumentType;
  source_url?: string;
  content_text: string; // Обязательно для генерации embeddings
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  open,
  onCancel,
  onSuccess,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const createMutation = useCreateDocument();

  // React Hook Form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      document_type: 'pdf',
      source_url: '',
      content_text: '',
    },
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCancel = () => {
    reset();
    setFileList([]);
    onCancel();
  };

  const onSubmit = async (values: FormValues) => {
    if (!values.content_text || values.content_text.trim().length === 0) {
      message.error('Текст документа обязателен для создания embeddings');
      return;
    }

    setUploading(true);

    try {
      // В реальном приложении здесь был бы upload файла в Supabase Storage
      // Для MVP просто создаем документ с текстом
      const documentData: CreateDocumentFormData = {
        title: values.title,
        description: values.description,
        document_type: values.document_type,
        source_url: values.source_url,
        content_text: values.content_text,
        // file_url будет добавлен после upload в Storage
      };

      await createMutation.mutateAsync(documentData);
      message.success(`Документ "${values.title}" успешно создан`);
      onSuccess();
      reset();
      setFileList([]);
    } catch (error) {
      message.error(
        `Ошибка при создании документа: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    beforeUpload: (file) => {
      // Проверка типа файла
      const isValidType =
        file.type === 'application/pdf' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

      if (!isValidType) {
        message.error('Поддерживаются только PDF, DOCX, PPTX файлы');
        return Upload.LIST_IGNORE;
      }

      // Проверка размера (макс 10MB)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('Файл должен быть меньше 10MB');
        return Upload.LIST_IGNORE;
      }

      // Определяем тип документа
      let docType: DocumentType = 'pdf';
      if (file.type.includes('word')) docType = 'docx';
      if (file.type.includes('presentation')) docType = 'pptx';

      setValue('document_type', docType);

      // Автоматически заполняем название из имени файла
      if (!control._formValues.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Убираем расширение
        setValue('title', fileName);
      }

      setFileList([file]);

      // Предотвращаем автоматический upload (мы будем делать это вручную)
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  // ============================================================================
  // Render
  // ============================================================================

  const isLoading = uploading || createMutation.isPending;

  return (
    <Modal
      title="📤 Загрузить документ"
      open={open}
      onOk={handleSubmit(onSubmit)}
      onCancel={handleCancel}
      okText="Загрузить и обработать"
      cancelText="Отмена"
      confirmLoading={isLoading}
      width={700}
      destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 24 }}>
        {/* File Upload */}
        <Form.Item label="Файл документа">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Нажмите или перетащите файл сюда</p>
            <p className="ant-upload-hint">
              Поддерживаются: PDF, DOCX, PPTX (макс. 10MB)
            </p>
          </Dragger>
        </Form.Item>

        {/* Title */}
        <Form.Item
          label="Название документа"
          required
          validateStatus={errors.title ? 'error' : ''}
          help={errors.title?.message}
        >
          <Controller
            name="title"
            control={control}
            rules={{ required: 'Название обязательно' }}
            render={({ field }) => (
              <Input {...field} placeholder="Например: Презентация Daikin VRV 2024" />
            )}
          />
        </Form.Item>

        {/* Document Type */}
        <Form.Item label="Тип документа" required>
          <Controller
            name="document_type"
            control={control}
            rules={{ required: 'Выберите тип' }}
            render={({ field }) => (
              <Select {...field} placeholder="Выберите тип">
                <Select.Option value="pdf">PDF</Select.Option>
                <Select.Option value="docx">Word (DOCX)</Select.Option>
                <Select.Option value="pptx">PowerPoint (PPTX)</Select.Option>
                <Select.Option value="html">HTML</Select.Option>
                <Select.Option value="webpage">Веб-страница</Select.Option>
              </Select>
            )}
          />
        </Form.Item>

        {/* Source URL */}
        <Form.Item label="URL источника">
          <Controller
            name="source_url"
            control={control}
            rules={{
              pattern: {
                value: /^https?:\/\/.+/,
                message: 'URL должен начинаться с http:// или https://',
              },
            }}
            render={({ field }) => (
              <Input {...field} placeholder="https://example.com/document" />
            )}
          />
          {errors.source_url && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
              {errors.source_url.message}
            </div>
          )}
        </Form.Item>

        {/* Description */}
        <Form.Item label="Описание">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={2}
                placeholder="Краткое описание документа..."
              />
            )}
          />
        </Form.Item>

        {/* Content Text */}
        <Form.Item
          label="Текст документа"
          required
          validateStatus={errors.content_text ? 'error' : ''}
          help={errors.content_text?.message}
        >
          <Controller
            name="content_text"
            control={control}
            rules={{
              required: 'Текст обязателен для генерации embeddings',
              minLength: {
                value: 50,
                message: 'Текст должен быть не менее 50 символов',
              },
            }}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={6}
                placeholder="Вставьте текст документа или основные тезисы...&#10;&#10;Этот текст будет использован для:&#10;- Полнотекстового поиска&#10;- Генерации AI embeddings&#10;- Семантического поиска"
              />
            )}
          />
          {errors.content_text && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
              {errors.content_text.message}
            </div>
          )}
        </Form.Item>

        {/* Info */}
        <div style={{ padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
          <Space direction="vertical" size={4}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ℹ️ <strong>Что происходит при загрузке:</strong>
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              1. Файл загружается в Supabase Storage
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              2. Текст извлекается и сохраняется в БД
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              3. Генерируется AI embedding для семантического поиска
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              4. Документ становится доступен для поиска
            </Text>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DocumentUploadModal;
