# Архитектура приложения MarketMonitor

## 1. Обзор проекта

**Название:** MarketMonitor

**Цель:** Мониторинг активностей климатического рынка России с использованием AI для поиска и обработки информации.

**Основные характеристики:**
- Товарные сегменты: бытовые кондиционеры, промышленная техника, мультизональные системы, вентиляционные системы, тепловое оборудование, IoT, сервисные услуги
- Каналы: B2B, B2G, B2C
- Целевая аудитория: руководители компаний, коммерческий департамент, продуктовые менеджеры, маркетологи
- Сроки MVP: 4 недели

**Ключевая функциональность:**
- Автоматический поиск событий климатического рынка через AI
- Управление библиотекой промптов для AI (admin only)
- Расписание автоматических запусков поиска
- Просмотр и анализ найденных событий
- Экспорт отчетов в различные форматы
- Ролевой контроль доступа (администратор, пользователь)

---

## 2. Технологический стек

### Frontend
- **React 18+** с TypeScript - основной фреймворк
- **Vite** - быстрый bundler
- **Ant Design** / **shadcn/ui** - компоненты UI
- **Zustand** - управление состоянием приложения
- **TanStack Query (React Query)** - кеширование и синхронизация данных с сервером
- **Recharts** - интерактивные графики и диаграммы
- **Tailwind CSS** - утилити для стилизации
- **Хостинг:** Netlify

### Backend & Database
- **Supabase** - полнофункциональный Backend-as-a-Service
  - **PostgreSQL** - реляционная БД для хранения всех данных
  - **Supabase Auth** - аутентификация и авторизация
  - **Row Level Security (RLS)** - безопасность на уровне БД
  - **Edge Functions** - серверная логика без управления серверами
  - **Storage** (опционально) - хранилище файлов и изображений
  - **Realtime** (опционально) - для live-обновлений

### AI Layer
- **Anthropic Claude API** (Claude Sonnet 4) - основной LLM для поиска информации
- **Web Search Tool** - поиск информации в интернете
- **Промпты** - хранятся в БД и управляются через админ-панель

### CI/CD & Автоматизация
- **GitHub Actions** - ежедневные запуски поиска по расписанию
- **Supabase Cron Jobs** (опционально) - альтернатива для планирования
- **Git** - управление версиями

---

## 3. Система авторизации и ролей

### 3.1 Модель ролей

#### Администратор (role: 'admin')
Полный доступ к системе:
- ✅ Управление библиотекой промптов (создание, редактирование, удаление)
- ✅ Настройка расписания выполнения джобов (cron schedule)
- ✅ Управление пользователями (создание, редактирование, деактивация)
- ✅ Просмотр всех событий и отчетов
- ✅ Скачивание отчетов
- ✅ Ручной запуск AI-поиска
- ✅ Просмотр логов и статистики выполнения
- ✅ Настройка параметров системы

#### Обычный пользователь (role: 'user')
Ограниченный доступ:
- ✅ Просмотр событий (только чтение)
- ✅ Фильтрация и поиск событий
- ✅ Просмотр дашбордов и аналитики
- ✅ Скачивание отчетов (Excel/CSV)
- ❌ Редактирование данных
- ❌ Управление промптами
- ❌ Управление пользователями
- ❌ Настройка расписания

### 3.2 Реализация авторизации

#### Supabase Auth + Custom Claims

```sql
-- Расширение таблицы профилей
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Триггер для создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Row Level Security (RLS) Policies

**Для таблицы events:**
```sql
-- Все авторизованные пользователи могут читать события
CREATE POLICY "Users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

-- Только админы могут модифицировать события
CREATE POLICY "Only admins can modify events"
  ON events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Для таблицы ai_prompts:**
```sql
-- Все могут читать промпты
CREATE POLICY "Users can view prompts"
  ON ai_prompts FOR SELECT
  TO authenticated
  USING (true);

-- Только админы могут управлять промптами
CREATE POLICY "Only admins can manage prompts"
  ON ai_prompts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Для таблицы user_profiles:**
```sql
-- Все могут видеть свой профиль
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Админы могут видеть все профили
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Только админы могут управлять пользователями
CREATE POLICY "Only admins can manage users"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Для таблицы job_schedules:**
```sql
-- Все могут видеть расписания
CREATE POLICY "Users can view schedules"
  ON job_schedules FOR SELECT
  TO authenticated
  USING (true);

-- Только админы могут управлять расписанием
CREATE POLICY "Only admins can manage schedules"
  ON job_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 4. Структура базы данных

### 4.1 Таблица: `user_profiles`
Расширенная информация о пользователях и их ролях.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Ссылка на auth.users |
| email | TEXT | Email пользователя |
| full_name | TEXT | Полное имя |
| role | TEXT | 'admin' или 'user' |
| is_active | BOOLEAN | Активен ли аккаунт |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |
| created_by | UUID (FK) | Кто создал пользователя |

### 4.2 Таблица: `events`
Основная таблица для хранения найденных событий рынка.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| date | DATE | Дата события |
| segment | TEXT | Товарный сегмент (кондиционеры, техника и т.д.) |
| geography | TEXT | Регион России |
| channel | TEXT | Канал продажи (B2B/B2G/B2C) |
| event_type | TEXT | Тип события (акция, цены, тендер, соглашение, PR, регулирование) |
| company | TEXT | Название компании |
| description | TEXT | Полное описание события |
| criticality | INTEGER | Оценка важности (1-5) |
| source_url | TEXT | Ссылка на источник информации |
| raw_data | JSONB | Сырые данные от AI (полный ответ API) |
| found_by_search_run_id | UUID (FK) | Какой запуск поиска нашел это событие |
| created_at | TIMESTAMP | Когда добавлено в систему |
| updated_at | TIMESTAMP | Дата последнего обновления |

### 4.3 Таблица: `ai_prompts`
Библиотека промптов для различных типов поиска.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| name | TEXT | Название промпта (уникальное) |
| description | TEXT | Описание назначения и результатов |
| prompt_template | TEXT | Шаблон с переменными вида {variable_name} |
| search_type | TEXT | Категория поиска (marketing, pricing, regulations и т.д.) |
| is_active | BOOLEAN | Активен ли промпт |
| parameters | JSONB | Параметры по умолчанию (JSON схема) |
| created_by | UUID (FK) | Кто создал промпт |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |

**Структура `parameters` JSONB:**
```json
{
  "date_range_days": 7,
  "segments": ["кондиционеры", "техника"],
  "geographies": ["Москва", "СПб"],
  "channels": ["B2B", "B2C"],
  "include_pr": true,
  "min_criticality": 2
}
```

**Пример `prompt_template`:**
```
Найди события на рынке климатического оборудования в России за последние {date_range_days} дней.
Сегменты: {segments}
География: {geography}
Каналы: {channels}

Ищи:
- Маркетинговые акции и промо
- Изменения цен
- Новые тендеры
- Регулирующие изменения
- PR активности

Формат результата: JSON с полями [date, segment, event_type, company, description, criticality, source_url]
```

### 4.4 Таблица: `search_runs`
История всех запусков поиска (ручных и автоматических).

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| prompt_id | UUID (FK) | Какой промпт был использован |
| status | TEXT | 'running' / 'completed' / 'failed' |
| events_found | INTEGER | Количество найденных событий |
| parameters_used | JSONB | Параметры, которые были использованы |
| error_message | TEXT | Описание ошибки (если failed) |
| triggered_by | UUID (FK) | Кто запустил (admin UID) |
| is_scheduled | BOOLEAN | Автоматический или ручной запуск |
| started_at | TIMESTAMP | Когда начал выполняться |
| completed_at | TIMESTAMP | Когда завершился |
| execution_time_seconds | INTEGER | Сколько секунд выполнялся |

### 4.5 Таблица: `job_schedules`
Расписание автоматических запусков поиска.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| prompt_id | UUID (FK) | Какой промпт запускать |
| name | TEXT | Название расписания (описательное) |
| cron_expression | TEXT | Cron выражение (например: '0 9 * * *') |
| is_active | BOOLEAN | Активно ли расписание |
| parameters | JSONB | Параметры для подстановки в промпт |
| last_run_at | TIMESTAMP | Когда был последний запуск |
| next_run_at | TIMESTAMP | Когда будет следующий запуск |
| last_run_status | TEXT | Статус последнего запуска |
| created_by | UUID (FK) | Кто создал расписание |
| created_at | TIMESTAMP | Дата создания |
| updated_at | TIMESTAMP | Дата последнего обновления |

**Примеры cron выражений:**
- `0 9 * * *` - каждый день в 09:00
- `0 9 * * 1` - каждый понедельник в 09:00
- `0 9 * * 1-5` - каждый рабочий день в 09:00
- `0 */6 * * *` - каждые 6 часов

### 4.6 Таблица: `audit_log` (опционально для MVP)
Логирование всех критичных действий для аудита.

| Поле | Тип | Описание |
|------|-----|---------|
| id | UUID (PK) | Уникальный идентификатор |
| user_id | UUID (FK) | Кто выполнил действие |
| action | TEXT | Тип действия (login, create_prompt, delete_event и т.д.) |
| resource_type | TEXT | Тип ресурса (prompt, event, user, schedule) |
| resource_id | UUID | ID ресурса, если применимо |
| details | JSONB | Дополнительные детали (старые/новые значения) |
| ip_address | TEXT | IP адрес пользователя |
| user_agent | TEXT | User Agent браузера |
| created_at | TIMESTAMP | Дата и время действия |

---

## 5. Архитектура приложения

### 5.1 Общая диаграмма слоев

```
┌──────────────────────────────────────────────┐
│        Frontend (Netlify)                     │
│  React + TypeScript + Ant Design/shadcn      │
│                                              │
│  Public Pages:                               │
│  ├─ Login / Register                         │
│  └─ Password Reset                           │
│                                              │
│  User Pages:                                 │
│  ├─ Dashboard (аналитика, read-only)         │
│  ├─ Events List (таблица с фильтрами)        │
│  ├─ Reports (экспорт Excel/CSV)              │
│  └─ Profile (личные данные)                  │
│                                              │
│  Admin Pages:                                │
│  ├─ Prompts Library (CRUD промптов)          │
│  ├─ Job Scheduler (расписание)               │
│  ├─ User Management (управление юзерами)     │
│  ├─ Search Runner (ручной запуск)            │
│  └─ System Logs (логи выполнения)            │
└────────────┬─────────────────────────────────┘
    │ REST API
    │ JWT Auth
    │ RLS checks
    ↓
┌──────────────────────────────────────────────┐
│      Supabase (Cloud Backend)                │
│                                              │
│  PostgreSQL Database:                        │
│  ├─ user_profiles                            │
│  ├─ events                                   │
│  ├─ ai_prompts                               │
│  ├─ search_runs                              │
│  ├─ job_schedules                            │
│  └─ audit_log                                │
│                                              │
│  Authentication & Security:                 │
│  ├─ Supabase Auth (JWT)                      │
│  └─ Row Level Security (RLS)                 │
│                                              │
│  Edge Functions (TypeScript):                │
│  ├─ ai-search (поиск через Claude API)       │
│  ├─ ai-summarize (суммаризация)              │
│  ├─ create-user (создание пользователей)     │
│  ├─ execute-scheduled-job (запуск джобов)    │
│  └─ export-report (генерация отчетов)        │
│                                              │
│  Realtime (опционально):                     │
│  └─ Live обновления найденных событий        │
└────────────┬─────────────────────────────────┘
    │ API Calls
    ↓
┌──────────────────────────────────────────────┐
│     External Services                        │
│                                              │
│  Anthropic Claude API:                       │
│  ├─ Claude Sonnet 4 (текстовая генерация)    │
│  └─ Web Search Tool (поиск в интернете)      │
│                                              │
│  Email Service (опционально):                │
│  └─ Уведомления об ошибках и отчеты         │
│                                              │
│  GitHub Actions (CI/CD):                     │
│  └─ Расписание запусков поиска               │
└──────────────────────────────────────────────┘
```

### 5.2 Поток данных

#### Ручной запуск поиска (администратор)

```
1. Admin выбирает промпт из библиотеки
2. Настраивает параметры (дата, сегмент и т.д.)
3. Кликает "Запустить поиск"
   │
   ├─→ Frontend отправляет запрос в Edge Function ai-search
   │
   ├─→ Edge Function:
   │   ├─ Проверяет права (только admin)
   │   ├─ Подставляет параметры в prompt_template
   │   ├─ Вызывает Anthropic Claude API с Web Search Tool
   │   ├─ Парсит результаты JSON
   │   ├─ Сохраняет события в таблицу events
   │   ├─ Обновляет search_runs (статус: completed)
   │   └─ Возвращает результат в Frontend
   │
   └─→ Frontend показывает результаты и обновляет UI
```

#### Автоматический запуск по расписанию

```
1. GitHub Actions запускается по расписанию (или Supabase Cron)
2. Загружает все активные job_schedules из БД
3. Для каждого расписания:
   │
   ├─→ Проверяет, пора ли запускать (cron expression)
   │
   ├─→ Вызывает Edge Function execute-scheduled-job
   │
   ├─→ Edge Function:
   │   ├─ Загружает prompt_template из ai_prompts
   │   ├─ Подставляет parameters из job_schedule
   │   ├─ Вызывает ai-search
   │   └─ Обновляет job_schedule (next_run_at, last_run_at)
   │
   └─→ Отправляет email-отчет админам (опционально)
```

#### Просмотр событий (пользователь)

```
1. User заходит на страницу Events
2. Frontend загружает события через API (с RLS фильтром)
3. User применяет фильтры (дата, сегмент, компания)
4. Frontend пересылает отфильтрованный запрос в Supabase
5. Supabase возвращает только события (RLS гарантирует доступ)
6. Frontend показывает таблицу с пагинацией и сортировкой
```

#### Экспорт отчета

```
1. User выбирает период и параметры экспорта
2. Кликает "Скачать отчет"
3. Frontend отправляет запрос в Edge Function export-report
4. Edge Function:
   ├─ Загружает данные из events с фильтрами
   ├─ Форматирует в Excel/CSV
   ├─ Возвращает файл
5. Frontend скачивает файл браузером
```

---

## 6. Ключевые функциональные модули

### 6.1 Модуль авторизации

#### Регистрация и вход

**Процесс регистрации:**
1. Новый пользователь переходит на страницу Sign Up
2. Вводит email и пароль
3. Supabase Auth создает аккаунт
4. Триггер БД автоматически создает профиль в `user_profiles` с ролью 'user'
5. Пользователю отправляется письмо с подтверждением (опционально)

**Правило для первого админа:**
- Первый пользователь, который зарегистрируется в системе, становится администратором
- Это проверяется в Edge Function или Trigger
- Все последующие новые пользователи по умолчанию получают роль 'user'

**Проверка прав в Frontend:**

```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const { data: session } = useQuery(['session'], async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  });

  const { data: profile } = useQuery(['profile'], async () => {
    if (!session?.user) return null;
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    return data;
  }, { enabled: !!session?.user });

  const isAdmin = profile?.role === 'admin';
  const isActive = profile?.is_active ?? false;

  return {
    session,
    profile,
    isAdmin,
    isActive,
    canManagePrompts: isAdmin,
    canManageUsers: isAdmin,
    canManageSchedules: isAdmin,
  };
};
```

#### Защищенные маршруты

```typescript
// components/ProtectedRoute.tsx
interface ProtectedRouteProps {
  role?: 'admin' | 'user';
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  role,
  children
}) => {
  const { session, profile, isActive } = useAuth();

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!isActive) {
    return <div>Ваш аккаунт деактивирован</div>;
  }

  if (role && profile?.role !== role) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};

// Router setup
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    }
  />
  <Route
    path="/admin/*"
    element={
      <ProtectedRoute role="admin">
        <AdminLayout />
      </ProtectedRoute>
    }
  />
</Routes>
```

### 6.2 Управление пользователями (Admin only)

#### Создание нового пользователя

**Процесс:**
1. Администратор переходит в "Управление пользователями"
2. Кликает "Добавить пользователя"
3. Заполняет форму: email, имя, роль (admin/user)
4. Система отправляет запрос в Edge Function `create-user`
5. Edge Function:
   - Проверяет, что запрос от админа (RLS)
   - Создает пользователя через Supabase Admin API
   - Отправляет email с временным паролем/ссылкой для установки пароля
   - Создает запись в `user_profiles`
   - Возвращает результат

#### Управление пользователями

**Доступные операции:**
- ✅ Просмотр списка всех пользователей
- ✅ Просмотр профиля пользователя (email, имя, роль, статус)
- ✅ Изменение роли (user ↔ admin)
- ✅ Деактивация/активация аккаунта
- ✅ Просмотр активности (последний вход, дата создания)
- ✅ Отправка приглашения заново (если ссылка истекла)
- ✅ Удаление пользователя (архивирование, не удаление)

### 6.3 Библиотека промптов (Admin only)

#### CRUD операции

**Создание промпта:**
1. Admin кликает "Новый промпт"
2. Заполняет:
   - Название (уникальное)
   - Описание (для чего нужен)
   - Тип поиска (категория)
   - Шаблон промпта с переменными в фигурных скобках
   - Параметры по умолчанию (JSON)
3. Может тестировать промпт перед сохранением
4. Кликает "Сохранить"

**Редактирование:**
- Изменение всех полей
- История версий (опционально)

**Удаление:**
- Мягкое удаление (is_active = false)
- Или полное удаление (если не используется в расписаниях)

**Активация/деактивация:**
- Toggle `is_active` флаг
- Неактивные промпты не появляются в выпадающих списках для выбора

#### Тестирование промпта

1. Admin заполняет значения переменных
2. Система подставляет значения в prompt_template
3. Вызывает Claude API
4. Показывает результат перед сохранением
5. Если результат хороший - сохраняет промпт

**Пример использования переменных:**

Шаблон:
```
Найди события на рынке {segment} в {geography} за {date_range_days} дней.
Каналы: {channels}
```

При тестировании admin вводит:
- segment: "бытовые кондиционеры"
- geography: "Москва"
- date_range_days: "7"
- channels: "B2B, B2C"

Система отправляет в Claude:
```
Найди события на рынке бытовые кондиционеры в Москва за 7 дней.
Каналы: B2B, B2C
```

### 6.4 Планировщик джобов (Admin only)

#### Настройка расписания

**Процесс:**
1. Admin кликает "Новое расписание"
2. Выбирает промпт из библиотеки (dropdown)
3. Дает название расписанию (например: "Поиск аукций каждый день")
4. Выбирает тип повтора:
   - Ежедневно (выбор времени)
   - Еженедельно (выбор дней недели и времени)
   - Custom cron (прямой ввод cron выражения)
5. Настраивает параметры (которые подставятся в промпт)
6. Включает расписание (is_active = true)
7. Система рассчитывает next_run_at
8. Сохраняет в таблицу job_schedules

#### Визуальный Cron Builder

```typescript
// components/CronBuilder.tsx
// UI компонент для удобного создания cron выражений

Примеры для пользователя:
- "Каждый день в 09:00" → 0 9 * * *
- "Каждый понедельник в 10:00" → 0 10 * * 1
- "Каждый рабочий день в 09:00" → 0 9 * * 1-5
- "Каждые 6 часов" → 0 */6 * * *
- "Два раза в день (09:00, 17:00)" → 0 9,17 * * *

Предпросмотр:
- Показывает "Следующий запуск: 2024-01-15 09:00"
- Список следующих 5 запусков
```

#### История выполнения

**Таблица search_runs для этого расписания:**
- Статус последнего запуска (success/failed)
- Количество найденных событий
- Время выполнения (в секундах)
- Дата и время запуска
- Ошибка (если failed)

**UI дашборд:**
- График успешности запусков (success rate)
- График среднего времени выполнения
- Список последних 20 запусков

### 6.5 AI-поиск событий

#### Для администраторов (ручной запуск)

**Интерфейс "Запустить поиск вручную":**

```
1. Выбор промпта (dropdown)
   ├─ Название промпта
   └─ Его описание

2. Переопределение параметров (опционально)
   ├─ Дата начала / конца
   ├─ Сегменты (multi-select)
   ├─ География (multi-select)
   ├─ Каналы (multi-select)
   └─ Другие параметры (зависят от промпта)

3. Кнопка "Запустить"

4. Мониторинг выполнения (real-time)
   ├─ Статус: "Отправляю запрос..."
   ├─ Статус: "Claude AI обрабатывает..."
   ├─ Статус: "Сохраняю события..."
   └─ Результат: "Найдено 15 новых событий"

5. Таблица найденных событий
   ├─ Дата
   ├─ Компания
   ├─ Тип события
   ├─ Описание
   ├─ Критичность (звезды 1-5)
   └─ Действия (просмотр, редактирование)
```

**Детали процесса:**
1. Frontend отправляет запрос на Edge Function `ai-search`
2. Проверяется, что user = admin (RLS)
3. Загружается промпт из БД
4. Подставляются параметры в template
5. Вызывается Anthropic Claude API с инструкцией вернуть JSON
6. Результаты парсятся и валидируются
7. Новые события сохраняются в таблицу events
8. Записываются в search_runs с количеством найденных
9. Frontend показывает результаты real-time (опционально через Realtime)

#### Автоматический режим (по расписанию)

**Как работает:**
1. GitHub Actions запускается по расписанию (например, каждый день в 8:55 UTC)
2. Скрипт загружает все активные job_schedules с is_active = true
3. Для каждого расписания:
   - Проверяет, пришло ли время (текущее время ≥ next_run_at)
   - Вызывает Edge Function execute-scheduled-job
   - Function выполняет поиск как обычно
   - Обновляет last_run_at, next_run_at, last_run_status
4. После всех запусков может отправить email-отчет админам

**GitHub Actions workflow (.github/workflows/scheduled-search.yml):**
```yaml
name: Scheduled Market Search
on:
  schedule:
    - cron: '55 8 * * *'  # 08:55 UTC каждый день = 09:55 (MSK)

jobs:
  search:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger scheduled search
        run: |
          curl -X POST https://project-url.supabase.co/functions/v1/execute-scheduled-job \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

### 6.6 Просмотр событий (User & Admin)

#### Основная таблица событий

**Функциональность:**
- Список всех событий с пагинацией (по 50 на странице)
- Каждая строка содержит:
  - Дата события
  - Компания
  - Тип события
  - Краткое описание (первые 100 символов)
  - Критичность (звезды или цветовой индикатор)
  - Сегмент
  - Канал

**Фильтры:**
- По диапазону дат (date picker)
- По сегменту (multi-select)
- По типу события (checkbox group)
- По компании (текстовый поиск с autocomplete)
- По критичности (slider 1-5)
- По каналам (checkbox group)
- По источнику (какой поиск нашел)

**Сортировка:**
- По дате (по умолчанию новые первыми)
- По критичности
- По компании
- По типу события

**Быстрый поиск:**
- Текстовое поле для поиска по описанию и компании
- Работает в real-time по мере ввода

#### Детальный просмотр события

Клик на строку открывает modal/drawer с информацией:
- Полная дата и время добавления
- Компания
- Тип события
- Полное описание
- Критичность (с объяснением)
- Сегмент
- Канал
- Источник (ссылка на оригинальный источник)
- Дата последнего обновления
- Кто добавил (если позволяет безопасность)

**Для админов дополнительно:**
- Кнопка редактирования (изменить описание, критичность и т.д.)
- Кнопка удаления (мягкое удаление)
- Просмотр сырых данных (raw_data JSONB)

### 6.7 Аналитика и отчеты (User & Admin)

#### Дашборды

**Главная страница дашборда содержит:**

1. **KPI Cards (быстрые метрики)**
   - Всего событий за период
   - Среднее критичность
   - Количество компаний (уникальных)
   - Тренд (вверх/вниз) за последние 7 дней

2. **Распределение событий по типам (Pie Chart)**
   - Акции
   - Изменение цен
   - Тендеры
   - Соглашения
   - PR
   - Регулирование
   - Прочее

3. **Динамика активности (Line Chart)**
   - X: дни/недели/месяцы (в зависимости от выбранного периода)
   - Y: количество событий
   - Разные линии для разных сегментов (опционально)

4. **Топ компаний по активности (Bar Chart)**
   - Горизонтальная диаграмма с компаниями
   - X: количество событий
   - Может быть отфильтрована по сегменту

5. **Распределение по сегментам (Horizontal Bar)**
   - Каждый сегмент и количество событий

6. **Карта критичности (Heat Map или Distribution)**
   - Сколько событий критичности 1, 2, 3, 4, 5
   - Тренд критичности во времени

7. **Активность по каналам (Donut Chart)**
   - B2B
   - B2C
   - B2G
   - Распределение событий

#### Экспорт отчетов

**Интерфейс экспорта:**
1. Выбор формата (Excel, CSV, PDF)
2. Выбор периода (последние 7 дней, месяц, custom)
3. Выбор колонок для экспорта (checkbox list)
4. Применение текущих фильтров (опционально)
5. Кнопка "Скачать"

**Формат Excel:**
- Красивое форматирование
- Заголовки с bold и background color
- Замороженная строка заголовков
- Автоширина колонок
- Отдельный лист со сводной статистикой
- Лист с описанием (дата создания, фильтры, количество строк)

**Формат CSV:**
- Стандартный CSV с запятыми (или точками с запятой)
- UTF-8 encoding
- Все данные как text

#### AI-суммаризация периода

**Функция "Получить AI-анализ периода":**
1. Выбор периода (дата от, дата до)
2. Кнопка "Анализировать"
3. Система:
   - Загружает события за период
   - Отправляет их в Claude API с инструкцией суммаризировать
   - Claude возвращает:
     * Топ 5 ключевых событий
     * Основные тренды на рынке
     * Оценка активности
     * Рекомендации для бизнеса
4. Результат показывается в formatted view
5. Можно скачать как PDF или Text

---

## 7. Структура проекта

```
market-monitor/
│
├── frontend/                          # React приложение (Netlify)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ProtectedRoute.tsx
│   │   │   │   └── RequireRole.tsx
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── UserManagement/
│   │   │   │   │   ├── UserList.tsx
│   │   │   │   │   ├── UserForm.tsx
│   │   │   │   │   └── UserDetail.tsx
│   │   │   │   │
│   │   │   │   ├── PromptLibrary/
│   │   │   │   │   ├── PromptList.tsx
│   │   │   │   │   ├── PromptEditor.tsx
│   │   │   │   │   └── PromptTester.tsx
│   │   │   │   │
│   │   │   │   ├── JobScheduler/
│   │   │   │   │   ├── ScheduleList.tsx
│   │   │   │   │   ├── ScheduleEditor.tsx
│   │   │   │   │   ├── CronBuilder.tsx
│   │   │   │   │   └── ExecutionHistory.tsx
│   │   │   │   │
│   │   │   │   ├── SearchRunner/
│   │   │   │   │   ├── SearchForm.tsx
│   │   │   │   │   ├── SearchMonitor.tsx
│   │   │   │   │   └── SearchResults.tsx
│   │   │   │   │
│   │   │   │   └── SystemLogs/
│   │   │   │       ├── LogViewer.tsx
│   │   │   │       └── LogFilters.tsx
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── EventsTable.tsx
│   │   │   │   ├── EventFilters.tsx
│   │   │   │   ├── EventDetail.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── ReportExport.tsx
│   │   │   │   └── Charts/
│   │   │   │       ├── EventTypeChart.tsx
│   │   │   │       ├── ActivityChart.tsx
│   │   │   │       ├── CompanyChart.tsx
│   │   │   │       └── CriticalityChart.tsx
│   │   │   │
│   │   │   └── layout/
│   │   │       ├── AppLayout.tsx
│   │   │       ├── AdminLayout.tsx
│   │   │       ├── UserLayout.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── Header.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   └── ResetPasswordPage.tsx
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── UsersPage.tsx
│   │   │   │   ├── PromptsPage.tsx
│   │   │   │   ├── SchedulerPage.tsx
│   │   │   │   ├── SearchRunnerPage.tsx
│   │   │   │   └── LogsPage.tsx
│   │   │   │
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── EventsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useEvents.ts
│   │   │   ├── usePrompts.ts
│   │   │   ├── useUsers.ts
│   │   │   ├── useSchedules.ts
│   │   │   ├── useSearchRuns.ts
│   │   │   └── useSupabase.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── supabase.ts           # Supabase client init
│   │   │   ├── api.ts                # API helper functions
│   │   │   ├── types.ts              # TypeScript interfaces
│   │   │   ├── rbac.ts               # Role-based access control
│   │   │   ├── validators.ts         # Data validation
│   │   │   ├── formatters.ts         # Date/number formatting
│   │   │   └── constants.ts          # App constants
│   │   │
│   │   ├── store/
│   │   │   └── useAppStore.ts        # Zustand store
│   │   │
│   │   ├── App.tsx                   # Main app component
│   │   ├── main.tsx                  # Entry point
│   │   └── index.css                 # Global styles
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── .env.example
│   └── README.md
│
├── supabase/                          # Supabase configuration
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_user_profiles.sql
│   │   ├── 003_events_table.sql
│   │   ├── 004_ai_prompts.sql
│   │   ├── 005_search_runs.sql
│   │   ├── 006_job_schedules.sql
│   │   ├── 007_audit_log.sql
│   │   └── 008_rls_policies.sql
│   │
│   ├── functions/
│   │   ├── ai-search/
│   │   │   ├── index.ts              # Main search function
│   │   │   └── types.ts              # Function types
│   │   │
│   │   ├── ai-summarize/
│   │   │   └── index.ts              # Summarization function
│   │   │
│   │   ├── create-user/
│   │   │   └── index.ts              # User creation (admin only)
│   │   │
│   │   ├── execute-scheduled-job/
│   │   │   └── index.ts              # Job execution
│   │   │
│   │   ├── export-report/
│   │   │   └── index.ts              # Report generation
│   │   │
│   │   └── shared/
│   │       ├── auth-check.ts         # Auth verification utilities
│   │       └── types.ts              # Shared types
│   │
│   └── config.toml
│
├── .github/
│   ├── workflows/
│   │   ├── scheduled-search.yml      # Daily scheduled search
│   │   ├── tests.yml                 # Run tests on PR
│   │   └── deploy.yml                # Deploy on main branch
│   │
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md
│
├── docs/
│   ├── architecture.md               # ✅ This file
│   ├── api.md                        # Edge Function API docs
│   ├── deployment.md                 # Deployment guide
│   ├── user-guide.md                 # User documentation
│   ├── admin-guide.md                # Administrator guide
│   └── development.md                # Developer guide
│
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── package.json                      # Root package.json (workspaces)
├── README.md                         # Project README
├── LICENSE                           # MIT License
└── .editorconfig                     # Editor configuration
```

---

## 8. План разработки (4 недели - MVP)

### Неделя 1: Фундамент + Авторизация

**День 1-2: Setup и подготовка**
- ✅ Инициализация React проекта (Vite)
- ✅ Инициализация Supabase проекта
- ✅ Настройка TypeScript
- ✅ Базовая структура папок
- ✅ Git репозиторий и GitHub Actions

**День 3-5: База данных и авторизация**
- ✅ Создание миграций (user_profiles, events, ai_prompts, job_schedules)
- ✅ Настройка Row Level Security (RLS)
- ✅ Настройка Supabase Auth
- ✅ Создание Edge Function для первого админа
- ✅ Триггеры для автоматического создания профилей

**День 6-7: Frontend авторизация**
- ✅ Компоненты Login/Register
- ✅ Protected Routes (ProtectedRoute, RequireRole)
- ✅ useAuth hook
- ✅ Главная страница после входа
- ✅ Logout функциональность

### Неделя 2: Admin функционал

**День 8-10: Управление пользователями и промптами**
- ✅ UserManagement компонент (список, фильтры)
- ✅ Форма создания пользователя
- ✅ Edge Function create-user
- ✅ PromptLibrary компонент (список промптов)
- ✅ PromptEditor (создание/редактирование)

**День 11-14: Планировщик и поиск**
- ✅ JobScheduler компонент
- ✅ CronBuilder для удобной настройки
- ✅ SearchRunner компонент (UI для ручного запуска)
- ✅ Edge Function ai-search (интеграция с Claude API)
- ✅ Мониторинг выполнения поиска (real-time)

### Неделя 3: User функционал + Аналитика

**День 15-17: Просмотр событий**
- ✅ EventsTable компонент с фильтрами
- ✅ EventFilters (date, segment, type, company, criticality)
- ✅ EventDetail modal для подробного просмотра
- ✅ Пагинация и сортировка
- ✅ Быстрый поиск по тексту

**День 18-21: Дашборды и отчеты**
- ✅ Dashboard с KPI cards
- ✅ Charts (Pie, Line, Bar) для визуализации
- ✅ ReportExport компонент (Excel, CSV)
- ✅ AI-суммаризация периода (Edge Function ai-summarize)
- ✅ Фильтры для экспорта

### Неделя 4: Автоматизация, полировка и тестирование

**День 22-24: Автоматизация**
- ✅ GitHub Actions workflow для расписания
- ✅ Edge Function execute-scheduled-job
- ✅ Email уведомления об ошибках (опционально)
- ✅ Логирование и мониторинг

**День 25-28: Финал**
- ✅ UX полировка (animations, loading states, error messages)
- ✅ Тестирование всех ролей и функций
- ✅ Документация (user-guide.md, admin-guide.md)
- ✅ Баг-фиксы и оптимизация
- ✅ Деплой на Netlify
- ✅ Финальное тестирование в production

---

## 9. Типы отслеживаемых событий

| Тип события | Описание | Примеры |
|-------------|---------|---------|
| **Акция** | Маркетинговые акции, скидки, промо-кампании | 15% скидка на кондиционеры, бесплатная доставка |
| **Цены** | Изменение цен на продукцию | Повышение цены на 5% с 01.01.2024 |
| **Условия оплаты** | Кредиты, рассрочки, условия | Беспроцентная рассрочка на 24 месяца |
| **PR** | Пресс-релизы, анонсы, новости | Новая линейка продуктов, назначение CEO |
| **Тендеры** | Госзакупки, коммерческие тендеры | Закупка 500 кондиционеров для поликлиник |
| **Соглашения** | Партнерства, дистрибуция, альянсы | Соглашение о дистрибуции с OZON |
| **Регулирование** | Сертификация, стандарты, законы | Новый ГОСТ на энергоэффективность |
| **Маркетплейсы** | Новые каналы продаж | Вывод на Яндекс.Маркет, изменение комиссии |

---

## 10. Безопасность

### Аутентификация

- ✅ JWT токены через Supabase Auth
- ✅ Автоматическое обновление токенов (refresh)
- ✅ Logout и отзыв сессий
- ✅ Secure HTTP-only cookies (если нужны)
- ✅ Email-based verification для новых аккаунтов (опционально)

### Авторизация

- ✅ Row Level Security (RLS) на уровне БД
- ✅ Проверка роли в каждом Edge Function
- ✅ Frontend checks для UX (не показываем кнопки админа для user)
- ✅ Backend enforces permissions (ALWAYS!)

### Защита данных

- ✅ API ключи (SUPABASE_URL, ANON_KEY) в .env
- ✅ Service Role Key в GitHub Secrets (для Edge Functions и CI/CD)
- ✅ Anthropic API key в Supabase Secrets
- ✅ CORS настройки (только разрешенные домены)
- ✅ Rate limiting для AI запросов (избежать abuse)
- ✅ Валидация всех входных данных
- ✅ SQL injection защита (параметризованные запросы)
- ✅ XSS защита (Sanitize HTML в описаниях событий)

### Аудит

- ✅ audit_log таблица для критичных действий
- ✅ Логирование всех операций админа (create/update/delete)
- ✅ IP адреса и timestamps
- ✅ Просмотр логов только админами

---

## 11. Мониторинг и метрики

### Суpabase Dashboard
- Запросы к БД (количество, скорость)
- Производительность (slow queries)
- Использование Storage (если добавим файлы)
- Auth метрики (количество пользователей, active sessions)

### Логирование Edge Functions
- Успешные и ошибочные запросы
- Время выполнения
- Количество обработанных событий
- Ошибки и исключения

### Метрики AI использования
- Количество запросов к Claude API
- Потребление токенов (input/output)
- Стоимость (в контексте Anthropic account)
- Успешность запросов (успех/ошибка)

### Метрики приложения
- Количество найденных событий за период
- Успешность расписаний (success rate)
- Среднее время выполнения поиска
- Количество активных пользователей
- Ошибки и downtime
- Performance (FCP, LCP, CLS)

---

## 12. Пример UI flow

### Для администратора

```
[Login]
   ↓
[Admin Dashboard]
   ├─ Боковое меню с разделами
   │  ├─ Управление пользователями
   │  ├─ Библиотека промптов
   │  ├─ Планировщик джобов
   │  ├─ Запуск поиска
   │  ├─ Просмотр событий
   │  ├─ Логи выполнения
   │  └─ Профиль / Выход
   │
   ├─ [Управление пользователями]
   │  ├─ Таблица со всеми пользователями
   │  ├─ Кнопка "+ Добавить пользователя"
   │  ├─ Поиск/фильтр по email
   │  ├─ Изменение ролей
   │  ├─ Деактивация аккаунтов
   │  └─ История активности пользователя
   │
   ├─ [Библиотека промптов]
   │  ├─ Таблица промптов
   │  ├─ Кнопка "+ Новый промпт"
   │  ├─ Форма редактирования (name, description, template)
   │  ├─ Тестирование промпта перед сохранением
   │  ├─ Активация/деактивация
   │  └─ Удаление промпта
   │
   ├─ [Планировщик]
   │  ├─ Список активных расписаний
   │  ├─ Кнопка "+ Новое расписание"
   │  ├─ Выбор промпта
   │  ├─ Cron builder (UI для настройки времени)
   │  ├─ Настройка параметров
   │  ├─ История выполнения (таблица)
   │  ├─ Статус последнего запуска
   │  └─ Кнопка "Запустить сейчас"
   │
   ├─ [Запуск поиска]
   │  ├─ Выбор промпта (dropdown)
   │  ├─ Переопределение параметров (опционально)
   │  ├─ Кнопка "Запустить"
   │  ├─ Real-time мониторинг выполнения
   │  └─ Таблица найденных событий
   │
   ├─ [Просмотр событий]
   │  ├─ Таблица со всеми событиями (read-only для admins)
   │  ├─ Фильтры и поиск
   │  ├─ Клик на событие → модаль с деталями
   │  └─ Кнопки редактирования и удаления
   │
   └─ [Логи выполнения]
      ├─ История всех search runs
      ├─ Статус (success/failed)
      ├─ Количество найденных событий
      ├─ Время выполнения
      └─ Детали ошибок (если failed)
```

### Для обычного пользователя

```
[Login]
   ↓
[User Dashboard]
   ├─ Боковое меню с разделами
   │  ├─ Событий
   │  ├─ Дашборд (читай-только)
   │  ├─ Отчеты
   │  ├─ Профиль / Выход
   │  └─ (НЕТ: Управление пользователями, Промпты, Расписание)
   │
   ├─ [DashBoard]
   │  ├─ KPI cards (количество событий, avg критичность)
   │  ├─ Диаграммы (pie, line, bar)
   │  ├─ Фильтры по периоду и сегментам
   │  └─ Read-only (без редактирования)
   │
   ├─ [События]
   │  ├─ Таблица со всеми событиями (read-only)
   │  ├─ Фильтры (дата, сегмент, тип, компания, критичность)
   │  ├─ Поиск по описанию
   │  ├─ Клик на событие → модаль с полной информацией
   │  └─ Кнопка "Скачать отчет"
   │
   ├─ [Отчеты]
   │  ├─ Выбор периода (last 7 days, last month, custom)
   │  ├─ Выбор формата (Excel, CSV)
   │  ├─ Выбор колонок для экспорта
   │  ├─ Кнопка "Скачать отчет"
   │  ├─ Ссылка на "AI-анализ периода"
   │  │  ├─ Claude AI анализирует события за период
   │  │  ├─ Топ-5 ключевых событий
   │  │  ├─ Основные тренды
   │  │  ├─ Рекомендации для бизнеса
   │  │  └─ Кнопка "Скачать как PDF"
   │  │
   │  └─ История экспортов (опционально)
   │
   └─ [Профиль]
      ├─ Email и имя (read-only)
      ├─ Смена пароля
      └─ Выход
```

---

## 13. Интеграция с Claude API

### Основное использование

```typescript
// Edge Function ai-search/index.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

export async function executeAISearch(promptText: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514", // Latest Claude
    max_tokens: 4096,
    system: `You are a market research AI assistant for the Russian climate equipment market.
             Extract structured data about market events.
             Always return valid JSON in the format: [{ date, segment, event_type, company, description, criticality, source_url }]`,
    tools: [
      {
        name: "web_search",
        description: "Search the web for information about market events",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: promptText,
      },
    ],
  });

  return response;
}
```

### Cost estimation

```
Примерные затраты на Claude API:
- 1 запрос поиска: ~2000 input + 1000 output токенов
- Input: ~$0.003 (при цене $1.5 per 1M tokens)
- Output: ~$0.003 (при цене $3 per 1M tokens)
- За запрос: ~$0.006
- Если 1 поиск в день: ~$0.18/месяц
- Если 5 поисков в день: ~$0.90/месяц
- Если 20 поисков в день: ~$3.60/месяц

ВЫВОД: Claude API очень дешево, можно частые запуски!
```

---

## 14. Будущие улучшения (после MVP)

**Phase 2 (v1.1):**
- ✅ Telegram/Slack боты для уведомлений
- ✅ Более детальная статистика
- ✅ Экспорт в PowerPoint

**Phase 3 (v1.2):**
- ✅ Двухфакторная аутентификация (2FA)
- ✅ SSO для корпоративных клиентов
- ✅ Интеграция с CRM системами (Битрикс24, Salesforce)

**Phase 4 (v1.3):**
- ✅ ML для прогнозирования трендов
- ✅ Sentiment analysis для оценки тональности
- ✅ Скрейпинг специфических сайтов (более точный поиск)
- ✅ Мобильное приложение (React Native или Flutter)

---

## 15. Развертывание и CI/CD

### Окружения

**Development (локально):**
- Supabase local (Docker)
- React dev server (npm run dev)
- Edge Functions локально (supabase functions serve)

**Staging (опционально):**
- Отдельный Supabase проект
- Staging branch в GitHub
- Deploy на staging домен

**Production:**
- Основной Supabase проект
- Main branch в GitHub
- Deploy на Netlify
- Настроить CORS и Security Headers

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Build frontend
        run: npm run build

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2.0
        with:
          publish-dir: './dist'
          production-branch: main
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 16. Документация (файлы в /docs)

- **architecture.md** - ✅ This file (полная архитектура)
- **api.md** - Документация всех Edge Functions
- **deployment.md** - Гайд по развертыванию
- **user-guide.md** - Инструкция для обычных пользователей
- **admin-guide.md** - Инструкция для администраторов
- **development.md** - Гайд для разработчиков

---

## 17. Заключение

MarketMonitor - это современное приложение для мониторинга климатического рынка России с использованием AI для автоматического поиска и обработки информации.

**Ключевые преимущества архитектуры:**
- 🔒 Безопасность: RLS на уровне БД, JWT auth
- 👥 Масштабируемость: Supabase handle load automatically
- ⚡ Производительность: Vite, TanStack Query, lazy loading
- 🤖 AI-первый подход: Claude для поиска, промпты в БД
- 📊 Аналитика: Встроенные дашборды и отчеты
- 🔄 Автоматизация: GitHub Actions + Edge Functions
- 📱 Responsive: Mobile-first UI

Разработка 4-недельного MVP включает все необходимое для запуска полнофункционального приложения.

