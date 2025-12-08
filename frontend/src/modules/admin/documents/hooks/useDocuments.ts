/**
 * React Query hooks для работы с Documents API
 *
 * Endpoints:
 * - GET    /documents - список документов
 * - GET    /documents/:id - детали документа
 * - POST   /documents - создать документ
 * - POST   /documents/search - семантический поиск
 * - DELETE /documents/:id - удалить документ
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Document,
  DocumentWithRelations,
  CreateDocumentFormData,
  SemanticSearchRequest,
  SemanticSearchResult,
  DocumentType,
} from '@/shared/types';

// ============================================================================
// Query Keys
// ============================================================================

export const documentsKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsKeys.all, 'list'] as const,
  list: (filters?: DocumentFilters) => [...documentsKeys.lists(), filters] as const,
  details: () => [...documentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentsKeys.details(), id] as const,
  searches: () => [...documentsKeys.all, 'search'] as const,
  search: (query: string) => [...documentsKeys.searches(), query] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface DocumentFilters {
  document_type?: DocumentType;
  source_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Full-text search
  page?: number;
  limit?: number;
}

export interface DocumentsListResponse {
  data: Document[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentDetailResponse {
  data: DocumentWithRelations;
}

export interface DocumentCreateResponse {
  data: Document;
  message: string;
}

export interface DocumentDeleteResponse {
  message: string;
}

export interface SemanticSearchResponse {
  data: SemanticSearchResult[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Получить список документов
 */
async function fetchDocuments(filters?: DocumentFilters): Promise<DocumentsListResponse> {
  const {
    document_type,
    source_id,
    date_from,
    date_to,
    search,
    page = 1,
    limit = 50,
  } = filters || {};

  // Строим query params
  const params = new URLSearchParams();
  if (document_type) params.append('document_type', document_type);
  if (source_id) params.append('source_id', source_id);
  if (date_from) params.append('date_from', date_from);
  if (date_to) params.append('date_to', date_to);
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));

  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/documents-api?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch documents');
  }

  return response.json();
}

/**
 * Получить детали документа по ID
 */
async function fetchDocumentById(id: string): Promise<DocumentDetailResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/documents-api/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch document');
  }

  return response.json();
}

/**
 * Создать новый документ
 */
async function createDocument(data: CreateDocumentFormData): Promise<DocumentCreateResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/documents-api`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create document');
  }

  return response.json();
}

/**
 * Семантический поиск документов
 */
async function semanticSearch(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/documents-api/search`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to search documents');
  }

  return response.json();
}

/**
 * Удалить документ
 */
async function deleteDocument(id: string): Promise<DocumentDeleteResponse> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/documents-api/${id}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete document');
  }

  return response.json();
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook: Получить список документов
 */
export function useDocuments(filters?: DocumentFilters) {
  return useQuery({
    queryKey: documentsKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
}

/**
 * Hook: Получить детали документа
 */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentsKeys.detail(id || ''),
    queryFn: () => fetchDocumentById(id!),
    enabled: !!id, // Запускать только если id передан
  });
}

/**
 * Hook: Создать документ
 */
export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createDocument,
    onSuccess: () => {
      // Инвалидируем кэш списка документов
      queryClient.invalidateQueries({ queryKey: documentsKeys.lists() });
    },
  });
}

/**
 * Hook: Семантический поиск
 */
export function useSemanticSearch() {
  return useMutation({
    mutationFn: semanticSearch,
  });
}

/**
 * Hook: Удалить документ
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      // Инвалидируем кэш списка документов
      queryClient.invalidateQueries({ queryKey: documentsKeys.lists() });
    },
  });
}
