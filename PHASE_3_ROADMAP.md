# 🚀 Phase 3: Pages & Admin Features Roadmap

**Дата начала:** 2024-12-04
**Версия:** 0.3.0-PLANNING
**Статус:** ⏳ Ready to Start
**Задача:** Создать полный набор страниц приложения

---

## 📋 Overview

Phase 3 фокусируется на создании оставшихся страниц приложения:
1. **EventsPage** - полная страница событий с фильтрацией
2. **ReportsPage** - генерация отчетов и экспорт
3. **AdminPanel** - управление приложением

Все компоненты и хуки уже **готовы**, нужно только интегрировать их в страницы.

---

## 🎯 Task 1: EventsPage (2-3 часа)

### Что создать
```typescript
// frontend/src/modules/events/pages/EventsPage.tsx
```

### Чек-лист
- [ ] Создать файл EventsPage.tsx
- [ ] Добавить заголовок "События"
- [ ] Интегрировать EventsTable компонент (✅ READY)
- [ ] Добавить фильтры:
  - [ ] Фильтр по категории (select)
  - [ ] Фильтр по статусу (select)
  - [ ] Фильтр по дате (DateRange)
  - [ ] Поиск по названию (input)
- [ ] Добавить кнопку "Экспорт в CSV"
- [ ] Экспортировать через modules/events/index.ts
- [ ] Добавить маршрут в App.tsx: `/events`
- [ ] Добавить пункт в навигацию AppLayout

### Пример кода
```typescript
import React, { useState } from 'react';
import { Card, Row, Col, Input, Select, Button, DatePicker } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { EventsTable, useEventsList } from '../../index';
import AppLayout from '../../../shared/components/layout/AppLayout';

export const EventsPage: React.FC = () => {
  const [category, setCategory] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: events = [] } = useEventsList({
    category,
    status,
  });

  // Фильтрация по поиску
  const filtered = events.filter(e =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    // TODO: Реализовать экспорт в CSV
    console.log('Export CSV:', filtered);
  };

  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        <h1>События</h1>

        {/* Фильтры */}
        <Card style={{ marginBottom: '24px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={5}>
              <Input.Search
                placeholder="Поиск по названию..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Select
                placeholder="Категория"
                allowClear
                value={category}
                onChange={setCategory}
                options={[
                  { label: 'Новости', value: 'news' },
                  { label: 'Законодательство', value: 'legislation' },
                  { label: 'Исследования', value: 'research' },
                ]}
              />
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Select
                placeholder="Статус"
                allowClear
                value={status}
                onChange={setStatus}
                options={[
                  { label: 'Новое', value: 'new' },
                  { label: 'Обработано', value: 'processing' },
                  { label: 'Завершено', value: 'completed' },
                ]}
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                block
                onClick={handleExport}
              >
                CSV
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Таблица */}
        <Card>
          <EventsTable />
        </Card>
      </div>
    </AppLayout>
  );
};

export default EventsPage;
```

---

## 🎯 Task 2: ReportsPage (2-3 часа)

### Что создать
```typescript
// frontend/src/modules/export/pages/ReportsPage.tsx
```

### Чек-лист
- [ ] Создать папку `modules/export/`
- [ ] Создать файл ReportsPage.tsx
- [ ] Добавить заголовок "Отчеты"
- [ ] Добавить DateRange picker для выбора периода
- [ ] Добавить опции экспорта:
  - [ ] CSV (быстро)
  - [ ] Excel (с форматированием)
  - [ ] PDF (опционально)
- [ ] Добавить "AI Summary" кнопку (placeholder для Phase 4)
- [ ] Экспортировать через modules/export/index.ts
- [ ] Добавить маршрут в App.tsx: `/reports`
- [ ] Добавить пункт в навигацию AppLayout

### Пример кода
```typescript
import React, { useState } from 'react';
import { Card, Button, DatePicker, Row, Col, message, Space } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useEventsList } from '../../events';
import AppLayout from '../../../shared/components/layout/AppLayout';
import type { Dayjs } from 'dayjs';

export const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: events = [] } = useEventsList();

  // Фильтр по дате
  const filtered = dateRange
    ? events.filter(
        (e) =>
          new Date(e.created_at) >= dateRange[0].toDate() &&
          new Date(e.created_at) <= dateRange[1].toDate()
      )
    : events;

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const csv = [
        ['ID', 'Название', 'Категория', 'Статус', 'Дата'],
        ...filtered.map((e) => [
          e.id,
          e.title,
          e.category,
          e.status,
          new Date(e.created_at).toLocaleDateString('ru-RU'),
        ]),
      ]
        .map((row) => row.join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();

      message.success('Отчет скачан');
    } catch (error) {
      message.error('Ошибка при экспорте');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    message.info('Excel экспорт будет реализован');
  };

  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        <h1>Отчеты</h1>

        <Card>
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} lg={8}>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
              />
            </Col>
          </Row>

          <div style={{ marginBottom: '24px' }}>
            <p>
              <strong>События в отчете:</strong> {filtered.length}
            </p>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              loading={exporting}
            >
              CSV
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
            >
              Excel (Coming Soon)
            </Button>
            <Button disabled>
              AI Summary (Phase 4)
            </Button>
          </Space>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
```

---

## 🎯 Task 3: AdminPanel (3-4 часа)

### Что создать
```typescript
// frontend/src/modules/admin/pages/AdminPanel.tsx
// frontend/src/modules/admin/components/UserManager.tsx
// frontend/src/modules/admin/components/PromptLibrary.tsx
// frontend/src/modules/admin/components/JobScheduler.tsx
```

### Чек-лист

#### AdminPanel главная
- [ ] Создать папку `modules/admin/`
- [ ] Создать файл AdminPanel.tsx
- [ ] Добавить защиту: только админы могут заходить
- [ ] Создать 3 вкладки (Tabs):
  - [ ] "Пользователи"
  - [ ] "Промпты"
  - [ ] "Расписание"

#### UserManager
- [ ] Показывать список пользователей
- [ ] Кнопка "Добавить пользователя"
- [ ] Кнопка "Удалить"
- [ ] Показывать роль (admin/user)
- [ ] Показывать статус активности (active/inactive)

#### PromptLibrary
- [ ] Показывать список промптов
- [ ] Кнопка "Создать промпт"
- [ ] Редактирование названия и содержимого
- [ ] Кнопка "Тестировать" (заглушка)
- [ ] Кнопка "Удалить"

#### JobScheduler
- [ ] Показывать список расписаний
- [ ] Кнопка "Добавить расписание"
- [ ] Показывать cron выражение
- [ ] Показывать последний запуск
- [ ] Кнопка включить/отключить

### Пример кода: AdminPanel.tsx
```typescript
import React, { useState } from 'react';
import { Card, Tabs, Modal, message, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import useAuth from '../../auth/hooks/useAuth';
import AppLayout from '../../../shared/components/layout/AppLayout';
import UserManager from '../components/UserManager';
import PromptLibrary from '../components/PromptLibrary';
import JobScheduler from '../components/JobScheduler';

export const AdminPanel: React.FC = () => {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Spin size="large" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2>Доступ запрещен</h2>
          <p>Вы должны быть администратором для доступа к этой странице</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ padding: '24px' }}>
        <h1>Администрирование</h1>

        <Card>
          <Tabs
            items={[
              {
                key: 'users',
                label: 'Пользователи',
                children: <UserManager />,
              },
              {
                key: 'prompts',
                label: 'Промпты',
                children: <PromptLibrary />,
              },
              {
                key: 'schedules',
                label: 'Расписание',
                children: <JobScheduler />,
              },
            ]}
          />
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminPanel;
```

---

## 📝 Implementation Steps

### Step 1: EventsPage (30 мин)
1. Создать `modules/events/pages/EventsPage.tsx`
2. Скопировать пример кода выше
3. Добавить маршрут в App.tsx
4. Обновить AppLayout навигацию

### Step 2: ReportsPage (30 мин)
1. Создать `modules/export/` папку
2. Создать `modules/export/pages/ReportsPage.tsx`
3. Скопировать пример кода выше
4. Добавить маршрут в App.tsx
5. Обновить AppLayout навигацию

### Step 3: AdminPanel (60 мин)
1. Создать `modules/admin/` папку
2. Создать `AdminPanel.tsx`
3. Создать `UserManager.tsx` компонент
4. Создать `PromptLibrary.tsx` компонент
5. Создать `JobScheduler.tsx` компонент
6. Добавить маршрут в App.tsx (защищенный)
7. Обновить AppLayout навигацию

### Step 4: Final Updates
1. Создать index.ts файлы в каждом модуле
2. Проверить все маршруты работают
3. Проверить навигацию в AppLayout
4. Тестировать с реальными данными из Supabase
5. Коммитить: `feat: Phase 3 - Pages & Admin Features`

---

## 🎯 After Phase 3

Будут готовы для Phase 4:
- ✅ Все страницы приложения
- ✅ Полная навигация
- ✅ Все компоненты интегрированы
- ✅ Готово для Edge Functions

Phase 4 будет добавлять:
- OpenAI интеграция для поиска
- Экспорт в Excel/PDF
- Управление пользователями (backend)
- Расписание поисков (backend)

---

## 💾 Git Workflow

```bash
# Создать ветку
git checkout -b feature/phase-3-pages

# После каждого Task коммитить
git add frontend/src/modules/
git commit -m "feat: add EventsPage"

# После всех Tasks
git push origin feature/phase-3-pages

# Открыть PR и смержить
```

---

## ✅ Done Checklist

- [ ] Task 1: EventsPage completed
- [ ] Task 2: ReportsPage completed
- [ ] Task 3: AdminPanel completed
- [ ] App.tsx обновлен со всеми маршрутами
- [ ] AppLayout навигация обновлена
- [ ] Все компоненты протестированы
- [ ] Commit создан и отправлен
- [ ] Phase 3 завершена

---

**Создано:** 2024-12-04
**Версия:** 0.3.0-PLANNING
**Статус:** ⏳ Ready to Start
**Автор:** Claude Code
