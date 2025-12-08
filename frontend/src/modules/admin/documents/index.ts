/**
 * Documents Management Module
 * Экспорты для модуля управления документами
 */

export { DocumentsLibrary } from './components/DocumentsLibrary';
export { DocumentUploadModal } from './components/DocumentUploadModal';
export {
  useDocuments,
  useDocument,
  useCreateDocument,
  useSemanticSearch,
  useDeleteDocument,
  documentsKeys,
  type DocumentFilters,
} from './hooks/useDocuments';
