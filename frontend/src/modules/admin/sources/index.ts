/**
 * Sources Management Module
 * Экспорты для модуля управления источниками
 */

export { SourcesManager } from './components/SourcesManager';
export { SourceFormModal } from './components/SourceFormModal';
export {
  useSources,
  useSource,
  useCreateSource,
  useUpdateSource,
  useDeleteSource,
  sourcesKeys,
  type SourceFilters,
} from './hooks/useSources';
export {
  useSourceTypes,
  sourceTypesKeys,
} from './hooks/useSourceTypes';
