# 🔖 Session Checkpoint - 2024-12-05

**Время создания:** 2024-12-05 09:20
**Статус:** Phase 3.2 Backend API Complete ✅
**Следующий этап:** Phase 3.3 Frontend UI
**Версия проекта:** 0.4.0 → 0.5.0 (в процессе)

---

## 📊 Текущее состояние проекта

### ✅ Что завершено в этой сессии:

#### 1. Extended Architecture (Phase 3.1 - Database)
**Коммит:** `fbe63c4` - feat: extended architecture with source management

**Созданные файлы:**
- `supabase/migrations/005_sources_and_segments.sql` (600+ строк)
  - 6 новых таблиц: segments, geographies, source_types, sources, source_urls, prompt_segments
  - Расширены events и ai_prompts
  - RLS policies + indexes

- `supabase/migrations/006_seed_sources_data.sql` (412 строк)
  - 15+ источников (дистрибьюторы, производители, СМИ, ассоциации)
  - 8 сегментов оборудования (RAC, VRF, Chiller, AHU, и т.д.)
  - География РФ (страна, 7 ФО, 4 города)
  - 3 примера промптов (Daily/Weekly/Monthly)

- `frontend/src/shared/types/index.ts` (+200 строк)
  - Новые интерфейсы: SegmentEntity, Geography, Source, SourceType, SourceUrl
  - CriticalityLevel (1-5), SearchDepth (daily/weekly/monthly)
  - Типы для связей: MarketEventWithRelations, AIPromptWithRelations

- `ROADMAP.md` (2500+ строк) - детальный план Phase 3-7
- `PHASE3_EXTENDED_SUMMARY.md` (457 строк) - полное резюме изменений
- `DEVELOPMENT_STATUS.md` - обновлен с Phase 3-7

**Статистика:** 6 files changed, 2123 insertions(+)

#### 2. Backend API (Phase 3.2 - Edge Functions)
**Коммит:** `91a2390` - feat: add Edge Functions API for source management

**Созданные файлы:**
- `supabase/functions/sources-api/index.ts` (485 строк)
  - GET /sources (с фильтрами и пагинацией)
  - GET /sources/:id
  - POST /sources (admin only)
  - PATCH /sources/:id (admin only)
  - DELETE /sources/:id (admin only)

- `supabase/functions/source-urls-api/index.ts` (456 строк)
  - GET /source-urls?source_id=xxx
  - GET /source-urls/:id
  - POST /source-urls (admin only)
  - PATCH /source-urls/:id (admin only)
  - DELETE /source-urls/:id (admin only)

- `supabase/functions/segments-api/index.ts` (357 строк)
  - GET /segments
  - GET /segments/:id
  - POST /segments (admin only)
  - PATCH /segments/:id (admin only)

- `supabase/functions/geographies-api/index.ts` (333 строк)
  - GET /geographies (с фильтрами)
  - GET /geographies/:id
  - GET /geographies/:id/children
  - GET /geographies/tree (BONUS - полное дерево)

**Статистика:** 4 files changed, 1631 insertions(+)

**Ключевые особенности:**
- Строгая типизация TypeScript (NO any!)
- CORS поддержка
- Единый формат ApiResponse<T>
- Автоматическая проверка аутентификации
- Admin-only операции с проверкой роли
- Детальная обработка ошибок (400, 401, 403, 404, 405, 409, 500)
- Валидация данных (URL формат, code формат, priority 1-10)

---

## 🎯 Что нужно сделать дальше

### Phase 3.3: Frontend UI для Source Management

**Модуль:** `frontend/src/modules/admin/sources/`

#### Структура модуля:
```
frontend/src/modules/admin/sources/
├── components/
│   ├── SourcesManager.tsx           # Главная таблица источников
│   ├── SourceFormModal.tsx          # Форма создания/редактирования
│   ├── SourceUrlsManager.tsx        # Управление URL внутри источника
│   ├── SourceTypeTag.tsx            # Цветные badges для типов
│   └── SourceFilters.tsx            # Фильтры для таблицы
├── hooks/
│   ├── useSources.ts                # React Query hook для sources
│   ├── useSourceUrls.ts             # React Query hook для URLs
│   ├── useSegments.ts               # React Query hook для segments
│   ├── useGeographies.ts            # React Query hook для geographies
│   └── useSourceTypes.ts            # React Query hook для source_types
├── types/
│   └── index.ts                     # Локальные типы (если нужны)
└── index.ts                         # Module exports
```

---

## 📝 Детальный план Phase 3.3 (Frontend UI)

### Приоритет 1: API Hooks (1 день)

**Файл:** `frontend/src/modules/admin/sources/hooks/useSources.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Source, SourceWithType } from '@/shared/types';

// GET /sources
export function useSources(filters?: {
  page?: number;
  page_size?: number;
  type?: string;
  active?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  search?: string;
}) {
  return useQuery({
    queryKey: ['sources', filters],
    queryFn: async () => {
      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('sources-api', {
        method: 'GET',
        // Convert filters to query params
      });
      if (error) throw error;
      return data.data;
    },
  });
}

// POST /sources
export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: CreateSourceRequest) => {
      const { data, error } = await supabase.functions.invoke('sources-api', {
        method: 'POST',
        body: source,
      });
      if (error) throw error;
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// PATCH /sources/:id
export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSourceRequest }) => {
      const { data: result, error } = await supabase.functions.invoke(`sources-api/${id}`, {
        method: 'PATCH',
        body: data,
      });
      if (error) throw error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

// DELETE /sources/:id
export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke(`sources-api/${id}`, {
        method: 'DELETE',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}
```

**Аналогично создать:**
- `useSourceUrls.ts` - для source-urls-api
- `useSegments.ts` - для segments-api (GET only для обычных пользователей)
- `useGeographies.ts` - для geographies-api (GET only)
- `useSourceTypes.ts` - для source_types таблицы (прямой запрос к Supabase)

---

### Приоритет 2: SourcesManager компонент (2 дня)

**Файл:** `frontend/src/modules/admin/sources/components/SourcesManager.tsx`

**Функционал:**
- Ant Design Table со всеми источниками
- Колонки:
  - Name (с ссылкой на детали)
  - Type (badge с цветом)
  - Priority (1-10, цветной индикатор)
  - Frequency (daily/weekly/monthly, иконка)
  - Active (toggle switch)
  - Website URL (ссылка)
  - Actions (Edit, Delete, Manage URLs)

- Фильтры над таблицей:
  - Search input (поиск по названию)
  - Source Type select (дистрибьютор, производитель, и т.д.)
  - Frequency select (daily/weekly/monthly)
  - Active checkbox (показать только активные)
  - Priority range slider (1-10)

- Пагинация (default: 20 items per page)

- Кнопки:
  - "Добавить источник" (открывает SourceFormModal)
  - "Обновить" (refresh данных)

**Пример кода:**
```typescript
import { Table, Button, Space, Tag, Switch, message } from 'antd';
import { EditOutlined, DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { useSources, useUpdateSource, useDeleteSource } from '../hooks/useSources';
import { SourceFormModal } from './SourceFormModal';
import { SourceTypeTag } from './SourceTypeTag';
import type { SourceWithType } from '@/shared/types';

export const SourcesManager: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceWithType | null>(null);
  const [filters, setFilters] = useState({});

  const { data, isLoading } = useSources(filters);
  const updateMutation = useUpdateSource();
  const deleteMutation = useDeleteSource();

  const handleToggleActive = async (source: SourceWithType) => {
    try {
      await updateMutation.mutateAsync({
        id: source.id,
        data: { is_active: !source.is_active },
      });
      message.success('Статус обновлен');
    } catch (error) {
      message.error('Ошибка обновления');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Удалить источник?',
      content: 'Это действие необратимо. Все связанные URL также будут удалены.',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync(id);
          message.success('Источник удален');
        } catch (error) {
          message.error('Ошибка удаления');
        }
      },
    });
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, record: SourceWithType) => (
        <a onClick={() => {/* open detail modal */}}>{name}</a>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'source_type',
      key: 'type',
      render: (type: any) => <SourceTypeTag type={type?.code} />,
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      sorter: true,
      render: (priority: number) => (
        <Tag color={priority >= 8 ? 'red' : priority >= 5 ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Частота',
      dataIndex: 'check_frequency',
      key: 'frequency',
      render: (freq: string) => {
        const icons = { daily: '🟢', weekly: '🔵', monthly: '🟣' };
        return <>{icons[freq]} {freq}</>;
      },
    },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      key: 'active',
      render: (active: boolean, record: SourceWithType) => (
        <Switch
          checked={active}
          onChange={() => handleToggleActive(record)}
          loading={updateMutation.isPending}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: SourceWithType) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setEditingSource(record);
              setModalOpen(true);
            }}
          >
            Редактировать
          </Button>
          <Button
            icon={<LinkOutlined />}
            onClick={() => {/* open URLs manager */}}
          >
            URL
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Добавить источник
        </Button>
        {/* Filters here */}
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: data?.page,
          pageSize: data?.page_size,
          total: data?.total,
          showSizeChanger: true,
        }}
        onChange={(pagination, filters, sorter) => {
          setFilters({ page: pagination.current, page_size: pagination.pageSize });
        }}
      />

      <SourceFormModal
        open={modalOpen}
        source={editingSource}
        onClose={() => {
          setModalOpen(false);
          setEditingSource(null);
        }}
      />
    </div>
  );
};
```

---

### Приоритет 3: SourceFormModal компонент (1 день)

**Файл:** `frontend/src/modules/admin/sources/components/SourceFormModal.tsx`

**Функционал:**
- Ant Design Modal с формой
- react-hook-form + zod валидация
- Поля:
  - Name (required, text input)
  - Source Type (required, select из source_types)
  - Website URL (optional, URL input с валидацией)
  - Telegram Channel (optional, text input, format: @channel)
  - Description (optional, textarea)
  - Priority (required, slider 1-10, default: 5)
  - Check Frequency (required, radio: daily/weekly/monthly, default: daily)
  - Is Active (required, switch, default: true)

- Кнопки:
  - "Сохранить" (создать или обновить)
  - "Отмена"

**Пример кода:**
```typescript
import { Modal, Form, Input, Select, Slider, Switch, Radio, message } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateSource, useUpdateSource } from '../hooks/useSources';
import { useSourceTypes } from '../hooks/useSourceTypes';

const sourceSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  source_type_id: z.string().uuid('Выберите тип источника'),
  website_url: z.string().url('Некорректный URL').nullable().optional(),
  telegram_channel: z.string().regex(/^@?[a-zA-Z0-9_]+$/, 'Некорректный формат').nullable().optional(),
  description: z.string().nullable().optional(),
  priority: z.number().min(1).max(10),
  check_frequency: z.enum(['daily', 'weekly', 'monthly']),
  is_active: z.boolean(),
});

type SourceFormData = z.infer<typeof sourceSchema>;

interface Props {
  open: boolean;
  source?: SourceWithType | null;
  onClose: () => void;
}

export const SourceFormModal: React.FC<Props> = ({ open, source, onClose }) => {
  const { data: sourceTypes } = useSourceTypes();
  const createMutation = useCreateSource();
  const updateMutation = useUpdateSource();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<SourceFormData>({
    resolver: zodResolver(sourceSchema),
    defaultValues: source || {
      priority: 5,
      check_frequency: 'daily',
      is_active: true,
    },
  });

  const onSubmit = async (data: SourceFormData) => {
    try {
      if (source) {
        await updateMutation.mutateAsync({ id: source.id, data });
        message.success('Источник обновлен');
      } else {
        await createMutation.mutateAsync(data);
        message.success('Источник создан');
      }
      onClose();
      reset();
    } catch (error) {
      message.error('Ошибка сохранения');
    }
  };

  return (
    <Modal
      title={source ? 'Редактировать источник' : 'Создать источник'}
      open={open}
      onOk={handleSubmit(onSubmit)}
      onCancel={onClose}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      width={600}
    >
      <Form layout="vertical">
        <Form.Item label="Название" required validateStatus={errors.name ? 'error' : ''} help={errors.name?.message}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => <Input {...field} placeholder="Русклимат" />}
          />
        </Form.Item>

        <Form.Item label="Тип источника" required>
          <Controller
            name="source_type_id"
            control={control}
            render={({ field }) => (
              <Select {...field} placeholder="Выберите тип">
                {sourceTypes?.map(type => (
                  <Select.Option key={type.id} value={type.id}>
                    {type.name}
                  </Select.Option>
                ))}
              </Select>
            )}
          />
        </Form.Item>

        <Form.Item label="Website URL">
          <Controller
            name="website_url"
            control={control}
            render={({ field }) => <Input {...field} placeholder="https://example.com" />}
          />
        </Form.Item>

        <Form.Item label="Telegram канал">
          <Controller
            name="telegram_channel"
            control={control}
            render={({ field }) => <Input {...field} placeholder="@channel_name" />}
          />
        </Form.Item>

        <Form.Item label="Описание">
          <Controller
            name="description"
            control={control}
            render={({ field }) => <Input.TextArea {...field} rows={3} />}
          />
        </Form.Item>

        <Form.Item label={`Приоритет (1-10)`}>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Slider {...field} min={1} max={10} marks={{ 1: '1', 5: '5', 10: '10' }} />
            )}
          />
        </Form.Item>

        <Form.Item label="Частота проверки">
          <Controller
            name="check_frequency"
            control={control}
            render={({ field }) => (
              <Radio.Group {...field}>
                <Radio value="daily">🟢 Ежедневно</Radio>
                <Radio value="weekly">🔵 Еженедельно</Radio>
                <Radio value="monthly">🟣 Ежемесячно</Radio>
              </Radio.Group>
            )}
          />
        </Form.Item>

        <Form.Item label="Активен">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => <Switch {...field} checked={field.value} />}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
```

---

### Приоритет 4: SourceUrlsManager компонент (1 день)

**Файл:** `frontend/src/modules/admin/sources/components/SourceUrlsManager.tsx`

**Функционал:**
- Ant Design Modal со списком URL для источника
- Таблица URL:
  - URL (ссылка, кликабельная)
  - Type (news/products/blog/press-release, badge)
  - Description
  - Active (toggle)
  - Actions (Edit, Delete)

- Кнопка "Добавить URL"
- Форма добавления/редактирования URL (inline или в отдельном modal)

---

### Приоритет 5: Интеграция в AdminPanel (0.5 дня)

**Файл:** `frontend/src/modules/admin/pages/AdminPanel.tsx`

Добавить новую вкладку "Sources":

```typescript
const items = [
  {
    key: 'users',
    label: 'Пользователи',
    children: <UserManagement />,
  },
  {
    key: 'sources', // NEW!
    label: 'Источники',
    children: <SourcesManager />,
  },
  {
    key: 'prompts',
    label: 'Промпты',
    children: <PromptLibrary />,
  },
  {
    key: 'scheduler',
    label: 'Расписания',
    children: <JobScheduler />,
  },
];
```

---

## ⚠️ Важные технические детали

### 1. Вызов Edge Functions из Frontend

```typescript
import { supabase } from '@/lib/supabase';

// GET request
const { data, error } = await supabase.functions.invoke('sources-api', {
  method: 'GET',
  // Query params добавляются в URL вручную
});

// POST request
const { data, error } = await supabase.functions.invoke('sources-api', {
  method: 'POST',
  body: { name: 'Test', source_type_id: 'uuid' },
});

// PATCH request (с ID в пути)
const { data, error } = await supabase.functions.invoke(`sources-api/${id}`, {
  method: 'PATCH',
  body: { name: 'Updated' },
});
```

**Проблема:** Supabase JS SDK не поддерживает query parameters в `invoke()`.

**Решение:** Создать helper функцию:
```typescript
async function invokeFunctionWithParams(
  functionName: string,
  params?: Record<string, any>
): Promise<any> {
  const url = new URL(
    `${SUPABASE_URL}/functions/v1/${functionName}`
  );
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}
```

### 2. Admin-only проверка на Frontend

```typescript
import { useAuth } from '@/modules/auth/hooks/useAuth';

export const SourcesManager: React.FC = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <div>У вас нет прав для просмотра этой страницы</div>;
  }

  // ... rest of component
};
```

### 3. React Query настройки

В `frontend/src/main.tsx` должен быть QueryClient:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### 4. Типы для API ответов

Использовать типы из `@/shared/types`:
```typescript
import type {
  Source,
  SourceWithType,
  SourceUrl,
  SegmentEntity,
  Geography
} from '@/shared/types';

// Для пагинированных ответов
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
```

---

## 📋 Checklist для продолжения работы

### Перед началом:
- [ ] Прочитать этот checkpoint полностью
- [ ] Проверить, что миграции 005-006 применены на Supabase
- [ ] Проверить, что Edge Functions задеплоены на Supabase
- [ ] Убедиться, что frontend запускается (`npm run dev`)

### Phase 3.3 - Frontend UI:
- [ ] Создать папку `frontend/src/modules/admin/sources/`
- [ ] Создать hooks (5 файлов):
  - [ ] useSources.ts
  - [ ] useSourceUrls.ts
  - [ ] useSegments.ts
  - [ ] useGeographies.ts
  - [ ] useSourceTypes.ts
- [ ] Создать components (4 файла):
  - [ ] SourcesManager.tsx
  - [ ] SourceFormModal.tsx
  - [ ] SourceUrlsManager.tsx
  - [ ] SourceTypeTag.tsx
- [ ] Создать index.ts с exports
- [ ] Интегрировать в AdminPanel.tsx
- [ ] Тестировать весь flow (создание, редактирование, удаление)

### После Phase 3.3:
- [ ] Создать коммит
- [ ] Обновить DEVELOPMENT_STATUS.md
- [ ] Начать Phase 3.4: Specialized Prompts Library

---

## 🔗 Полезные ссылки

**Документация:**
- `ROADMAP.md` - полный план Phase 3-7
- `PHASE3_EXTENDED_SUMMARY.md` - резюме архитектуры
- `DEVELOPMENT_STATUS.md` - текущий статус
- `supabase/functions/README.md` - API документация (если создан)

**Коммиты:**
- `fbe63c4` - Extended architecture (Database)
- `91a2390` - Backend API (Edge Functions)

**Git статус:**
```
On branch main
Your branch is ahead of 'origin/main' by 2 commits.
  (use "git push" to publish your local commits)
```

**Не закоммиченные файлы:**
- `frontend/src/modules/dashboard/pages/DashboardPage.tsx` (modified)
- Различные документы и временные файлы (не важны)

---

## 🎯 Ожидаемый результат Phase 3.3

После завершения Frontend UI у нас будет:

1. **Полноценный admin интерфейс** для управления источниками
2. **CRUD операции** для sources и source_urls
3. **Фильтрация и поиск** в таблице источников
4. **Валидация форм** через zod
5. **Оптимистичные обновления** через React Query
6. **Адаптивный UI** на Ant Design

**Время выполнения:** 3-4 дня

**Следующий этап после 3.3:** Phase 3.4 - Specialized Prompts Library (добавление полей segment_id, geography_id, search_depth к промптам)

---

## 💾 Команды для восстановления контекста

```bash
# Проверить текущую ветку и коммиты
git log --oneline -n 5

# Проверить статус
git status

# Посмотреть последние изменения
git show fbe63c4
git show 91a2390

# Запустить frontend
cd frontend
npm run dev

# Проверить TypeScript
npm run type-check
```

---

**Checkpoint создан:** 2024-12-05 09:20
**Следующая сессия:** Начать с Phase 3.3 - Frontend UI
**Контакт:** См. DEVELOPMENT_STATUS.md

**Удачи! 🚀**
