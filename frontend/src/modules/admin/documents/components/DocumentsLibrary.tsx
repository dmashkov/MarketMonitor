/**
 * DocumentsLibrary - Библиотека документов
 *
 * Таблица всех документов с поиском и фильтрами
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
  DatePicker,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FilePptOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useDocuments, useDeleteDocument, useSemanticSearch, useGenerateDownloadUrl, type DocumentFilters } from '../hooks/useDocuments';
import type { Document, DocumentType, SemanticSearchResult } from '@/shared/types';
import { DocumentUploadModal } from './DocumentUploadModal';

const { Title, Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

/**
 * Иконки для типов документов
 */
const documentTypeIcons: Record<DocumentType, React.ReactNode> = {
  pdf: <FilePdfOutlined style={{ color: '#d32f2f' }} />,
  docx: <FileWordOutlined style={{ color: '#1976d2' }} />,
  pptx: <FilePptOutlined style={{ color: '#f57c00' }} />,
  html: <FileTextOutlined style={{ color: '#388e3c' }} />,
  webpage: <GlobalOutlined style={{ color: '#7b1fa2' }} />,
};

const documentTypeLabels: Record<DocumentType, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
  html: 'HTML',
  webpage: 'Веб-страница',
};

/**
 * Форматирует размер файла из байтов в человеческий формат
 */
const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const DocumentsLibrary: React.FC = () => {
  // State
  const [filters, setFilters] = useState<DocumentFilters>({
    page: 1,
    limit: 50,
  });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [semanticSearchQuery, setSemanticSearchQuery] = useState('');
  const [semanticSearchResults, setSemanticSearchResults] = useState<SemanticSearchResult[] | null>(null);
  const [semanticModalOpen, setSemanticModalOpen] = useState(false);

  // Hooks
  const { data, isLoading, refetch } = useDocuments(filters);
  const deleteDocumentMutation = useDeleteDocument();
  const semanticSearchMutation = useSemanticSearch();
  const generateDownloadUrlMutation = useGenerateDownloadUrl();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }));
  };

  const handleTypeFilter = (value: DocumentType | 'all') => {
    setFilters((prev) => ({
      ...prev,
      document_type: value === 'all' ? undefined : value,
      page: 1,
    }));
  };

  const handleDateRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] !== null && dates[1] !== null) {
      setFilters((prev) => ({
        ...prev,
        date_from: dates[0]!.format('YYYY-MM-DD'),
        date_to: dates[1]!.format('YYYY-MM-DD'),
        page: 1,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        date_from: undefined,
        date_to: undefined,
        page: 1,
      }));
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, limit: pageSize }));
  };

  const handleUpload = () => {
    setUploadModalOpen(true);
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteDocumentMutation.mutateAsync(id);
      message.success(`Документ "${title}" успешно удален`);
    } catch (error) {
      message.error(`Ошибка при удалении: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUploadModalClose = () => {
    setUploadModalOpen(false);
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    refetch();
    message.success('Документ успешно загружен и обработан');
  };

  const handleSemanticSearch = async () => {
    if (!semanticSearchQuery.trim()) {
      message.warning('Введите поисковый запрос');
      return;
    }

    try {
      const result = await semanticSearchMutation.mutateAsync({
        query: semanticSearchQuery,
        limit: 10,
        threshold: 0.3,
      });

      setSemanticSearchResults(result.data);
      setSemanticModalOpen(true);

      if (result.data.length === 0) {
        message.info('Похожих документов не найдено. Попробуйте другой запрос.');
      }
    } catch (error) {
      message.error(`Ошибка поиска: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      // Генерируем signed URL
      const signedUrl = await generateDownloadUrlMutation.mutateAsync(url);

      // Создаем временный элемент для скачивания
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success('Файл скачивается');
    } catch (error) {
      message.error(`Ошибка скачивания: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpenFile = async (url: string) => {
    try {
      // Генерируем signed URL
      const signedUrl = await generateDownloadUrlMutation.mutateAsync(url);

      // Открываем в новой вкладке
      window.open(signedUrl, '_blank');
    } catch (error) {
      message.error(`Ошибка открытия файла: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnsType<Document> = [
    {
      title: 'Тип',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 60,
      align: 'center',
      render: (type: DocumentType) => (
        <Tooltip title={documentTypeLabels[type]}>
          <span style={{ fontSize: 20 }}>{documentTypeIcons[type]}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (title: string, record) => {
        const contentPreview = record.content_text?.substring(0, 200) || 'Нет текста';
        return (
          <Tooltip title={contentPreview} overlayStyle={{ maxWidth: '400px' }}>
            <Space direction="vertical" size={0}>
              <Text strong>{title}</Text>
              {record.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.description.substring(0, 100)}
                  {record.description.length > 100 && '...'}
                </Text>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Дата публикации',
      dataIndex: 'published_date',
      key: 'published_date',
      width: 130,
      render: (date: string | null) =>
        date ? dayjs(date).format('DD.MM.YYYY') : '—',
      sorter: true,
    },
    {
      title: 'Источник',
      dataIndex: 'source_url',
      key: 'source_url',
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
      title: 'Размер',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      align: 'center',
      render: (size: number | null | undefined) => formatFileSize(size),
    },
    {
      title: 'Файл',
      dataIndex: 'file_url',
      key: 'file_url',
      width: 100,
      align: 'center',
      render: (url: string | null, record) =>
        url ? (
          <Space size="small">
            <Tooltip title="Открыть файл">
              <Button
                type="text"
                size="small"
                icon={documentTypeIcons[record.document_type]}
                onClick={() => handleOpenFile(url)}
                loading={generateDownloadUrlMutation.isPending}
              />
            </Tooltip>
            <Tooltip title="Скачать файл">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(url, record.title)}
                loading={generateDownloadUrlMutation.isPending}
              />
            </Tooltip>
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Добавлен',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: Document) => (
        <Popconfirm
          title={`Удалить документ "${record.title}"?`}
          description="Это действие нельзя отменить"
          onConfirm={() => handleDelete(record.id, record.title)}
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
              loading={deleteDocumentMutation.isPending}
            />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  // Колонки для результатов semantic search
  const searchResultColumns: ColumnsType<SemanticSearchResult> = [
    {
      title: 'Тип',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 60,
      align: 'center',
      render: (type: DocumentType) => (
        <Tooltip title={documentTypeLabels[type]}>
          <span style={{ fontSize: 20 }}>{documentTypeIcons[type]}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (title: string, record) => {
        const contentPreview = record.content_text?.substring(0, 200) || 'Нет текста';
        return (
          <Tooltip title={contentPreview} overlayStyle={{ maxWidth: '400px' }}>
            <Space direction="vertical" size={0}>
              <Text strong>{title}</Text>
              {record.description && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.description.substring(0, 100)}
                  {record.description.length > 100 && '...'}
                </Text>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Дата публикации',
      dataIndex: 'published_date',
      key: 'published_date',
      width: 130,
      render: (date: string | null) =>
        date ? dayjs(date).format('DD.MM.YYYY') : '—',
    },
    {
      title: 'Источник',
      dataIndex: 'source_url',
      key: 'source_url',
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
      title: 'Сходство',
      dataIndex: 'similarity',
      key: 'similarity',
      width: 100,
      render: (similarity: number) => (
        <Tag color={similarity > 0.9 ? 'green' : similarity > 0.8 ? 'blue' : 'orange'}>
          {(similarity * 100).toFixed(0)}%
        </Tag>
      ),
      sorter: (a, b) => a.similarity - b.similarity,
      defaultSortOrder: 'descend',
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
            📄 Библиотека документов
          </Title>
          <Space>
            <Tooltip title="Обновить">
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleUpload}
            >
              Загрузить документ
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Space size="middle" wrap style={{ marginBottom: 16 }}>
          <Search
            placeholder="Полнотекстовый поиск..."
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />

          <Select
            placeholder="Тип документа"
            style={{ width: 180 }}
            onChange={handleTypeFilter}
            allowClear
            defaultValue="all"
          >
            <Select.Option value="all">Все типы</Select.Option>
            <Select.Option value="pdf">PDF</Select.Option>
            <Select.Option value="docx">Word</Select.Option>
            <Select.Option value="pptx">PowerPoint</Select.Option>
            <Select.Option value="html">HTML</Select.Option>
            <Select.Option value="webpage">Веб-страница</Select.Option>
          </Select>

          <RangePicker
            placeholder={['Дата от', 'Дата до']}
            format="DD.MM.YYYY"
            onChange={handleDateRangeChange}
            style={{ width: 250 }}
          />
        </Space>

        {/* Semantic Search */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="Семантический поиск (по смыслу)..."
            value={semanticSearchQuery}
            onChange={(e) => setSemanticSearchQuery(e.target.value)}
            onPressEnter={handleSemanticSearch}
            style={{ flex: 1 }}
            prefix={<ThunderboltOutlined />}
          />
          <Button
            type="dashed"
            icon={<ThunderboltOutlined />}
            onClick={handleSemanticSearch}
            loading={semanticSearchMutation.isPending}
          >
            Искать по смыслу
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table<Document>
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.limit || 50,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total} документов`,
          pageSizeOptions: ['20', '50', '100'],
          onChange: handlePageChange,
        }}
        scroll={{ x: 1000 }}
        size="middle"
      />

      {/* Upload Modal */}
      <DocumentUploadModal
        open={uploadModalOpen}
        onCancel={handleUploadModalClose}
        onSuccess={handleUploadSuccess}
      />

      {/* Semantic Search Results Modal */}
      <Modal
        title="🔍 Результаты семантического поиска"
        open={semanticModalOpen}
        onCancel={() => setSemanticModalOpen(false)}
        footer={null}
        width={1000}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Запрос: <Text strong>"{semanticSearchQuery}"</Text>
          </Text>
        </div>
        {semanticSearchResults && semanticSearchResults.length > 0 ? (
          <Table<SemanticSearchResult>
            columns={searchResultColumns}
            dataSource={semanticSearchResults}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Text type="secondary">По вашему запросу ничего не найдено. Попробуйте другой запрос.</Text>
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default DocumentsLibrary;
