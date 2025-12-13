/**
 * Prompts Management Module
 * Экспорты для модуля управления AI промптами
 */

export { PromptsManager } from './components/PromptsManager';
export { PromptFormModal } from './components/PromptFormModal';
export {
  usePrompts,
  usePrompt,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  promptsKeys,
  type PromptFilters,
  type CreatePromptFormDataAPI,
  type UpdatePromptFormDataAPI,
} from './hooks/usePrompts';
