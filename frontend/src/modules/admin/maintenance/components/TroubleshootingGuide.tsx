/**
 * TroubleshootingGuide
 *
 * Руководство по устранению неполадок с поиском
 */

import React from 'react';
import { Card, Input, Collapse, Typography, Tag, Space, Alert } from 'antd';
import {
  BugOutlined,
  SearchOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  ApiOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface TroubleshootingScenario {
  id: string;
  title: string;
  icon: React.ReactNode;
  severity: 'critical' | 'warning' | 'info';
  symptoms: string[];
  diagnosis: string[];
  solution: string[];
  prevention: string[];
}

const scenarios: TroubleshootingScenario[] = [
  {
    id: 'stuck-runs',
    title: 'Pipeline зависает (stuck runs)',
    icon: <ClockCircleOutlined />,
    severity: 'critical',
    symptoms: [
      'search_runs.status = "running" более 10 минут',
      'Новые запуски не стартуют',
      'UI показывает "бесконечный спиннер"',
    ],
    diagnosis: [
      'Проверить: SELECT * FROM search_runs WHERE status = \'running\' AND started_at < NOW() - INTERVAL \'10 minutes\'',
      'Проверить логи Edge Function search-orchestrator',
      'Возможно, зависание на вызове OpenAI API или Perplexity API',
    ],
    solution: [
      'Автоматическая очистка: pg_cron job "cleanup-stuck-runs" запускается каждые 15 минут',
      'Ручная очистка: UPDATE search_runs SET status = \'failed\', error_message = \'Manual timeout\' WHERE id = \'<stuck_run_id>\'',
      'Перезапустить pipeline с панели Admin',
    ],
    prevention: [
      'Проверяйте API keys (OpenAI, Perplexity)',
      'Увеличьте timeout в Edge Functions (если нужно)',
      'Мониторьте pg_cron job активность',
    ],
  },
  {
    id: 'no-documents',
    title: 'Не создаются документы',
    icon: <FileTextOutlined />,
    severity: 'critical',
    symptoms: [
      'Pipeline завершается со статусом "completed"',
      'documents_created = 0',
      'Таблица documents пустая за последние 24 часа',
    ],
    diagnosis: [
      'Проверить: SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL \'24 hours\'',
      'Проверить stages: SELECT * FROM search_runs_stages WHERE search_run_id = \'<last_run_id>\'',
      'Проверить sources: SELECT * FROM sources WHERE is_active = true',
    ],
    solution: [
      'Проверить, что источники активны: UPDATE sources SET is_active = true WHERE code IN (\'ABOK\', \'AVOK\', ...)',
      'Проверить Perplexity API key в Supabase Vault',
      'Проверить качество промптов в source-hunter',
      'Увеличить max_sources_per_run в monitoring_profiles',
    ],
    prevention: [
      'Регулярно проверяйте качество источников',
      'Мониторьте источники с 0 документов за неделю',
      'Обновляйте промпты на основе результатов',
    ],
  },
  {
    id: 'api-auth-failed',
    title: 'Ошибка аутентификации API',
    icon: <ApiOutlined />,
    severity: 'critical',
    symptoms: [
      'Error: "Invalid API key" или "Unauthorized"',
      'search_runs.error_message содержит "401" или "403"',
      'Pipeline падает на стадии "source_hunter" или "document_processor"',
    ],
    diagnosis: [
      'Проверить Supabase Vault: SELECT * FROM vault.secrets WHERE name IN (\'OPENAI_API_KEY\', \'PERPLEXITY_API_KEY\')',
      'Проверить срок действия ключей в OpenAI Dashboard и Perplexity Dashboard',
      'Проверить лимиты API (rate limits)',
    ],
    solution: [
      'Обновить ключи в Supabase Vault через Dashboard',
      'Убедиться, что Edge Functions имеют доступ к Vault',
      'Проверить billing в OpenAI/Perplexity (возможно, исчерпан баланс)',
      'Временно использовать fallback ключи (если настроены)',
    ],
    prevention: [
      'Настроить уведомления о балансе API',
      'Ротировать ключи каждые 3 месяца',
      'Мониторить usage через API dashboards',
    ],
  },
  {
    id: 'network-timeout',
    title: 'Network timeout (таймаут сети)',
    icon: <GlobalOutlined />,
    severity: 'warning',
    symptoms: [
      'Error: "Timeout" или "ETIMEDOUT"',
      'Edge Functions падают после 60-120 секунд',
      'Некоторые источники работают, другие - нет',
    ],
    diagnosis: [
      'Проверить медленные источники: SELECT source_id, AVG(execution_time_ms) FROM search_runs_stages GROUP BY source_id',
      'Проверить внешние источники (доступны ли сайты)',
      'Проверить Supabase Edge Functions timeout settings',
    ],
    solution: [
      'Увеличить timeout в fetch() вызовах (до 180 секунд)',
      'Добавить retry логику для медленных источников',
      'Временно отключить проблемные источники: UPDATE sources SET is_active = false WHERE code = \'<slow_source>\'',
      'Использовать pg_cron для асинхронной обработки',
    ],
    prevention: [
      'Мониторить скорость источников еженедельно',
      'Устанавливать reasonable timeouts (90-120 сек)',
      'Использовать async/parallel обработку',
    ],
  },
  {
    id: 'low-quality-docs',
    title: 'Документы низкого качества',
    icon: <FileTextOutlined />,
    severity: 'warning',
    symptoms: [
      'Документы создаются, но не содержат полезной информации',
      'content_text слишком короткий (<100 символов)',
      'Нет упоминаний брендов (brand_ids пусты)',
      'criticality_level всегда = 1',
    ],
    diagnosis: [
      'Проверить: SELECT title, LENGTH(content_text), brand_ids FROM documents ORDER BY created_at DESC LIMIT 10',
      'Проверить промпты в source-hunter и document-processor',
      'Проверить качество источников (возможно, контент изменился)',
    ],
    solution: [
      'Обновить промпты для лучшего извлечения контента',
      'Добавить валидацию минимальной длины content_text (>200 символов)',
      'Улучшить extraction логику в document-processor',
      'Отключить источники с низким качеством',
    ],
    prevention: [
      'Регулярно проверяйте качество документов (weekly)',
      'Используйте A/B тестирование промптов',
      'Мониторьте метрику "average content length"',
    ],
  },
  {
    id: 'duplicate-docs',
    title: 'Дубликаты документов',
    icon: <FileTextOutlined />,
    severity: 'info',
    symptoms: [
      'Одинаковые документы создаются при каждом запуске',
      'is_duplicate = true для многих документов',
      'Таблица documents растёт слишком быстро',
    ],
    diagnosis: [
      'Проверить: SELECT COUNT(*) FROM documents WHERE is_duplicate = true',
      'Проверить: SELECT title, COUNT(*) FROM documents GROUP BY title HAVING COUNT(*) > 1',
      'Проверить работу duplicate-detector агента',
    ],
    solution: [
      'Включить duplicate-detector в pipeline (если отключён)',
      'Улучшить алгоритм обнаружения дубликатов (использовать embeddings similarity)',
      'Удалить старые дубликаты: DELETE FROM documents WHERE is_duplicate = true AND created_at < NOW() - INTERVAL \'7 days\'',
    ],
    prevention: [
      'Используйте semantic similarity (embeddings) для обнаружения',
      'Проверяйте дубликаты еженедельно',
      'Настройте threshold для similarity (0.95 для точных дубликатов)',
    ],
  },
  {
    id: 'db-full',
    title: 'База данных заполнена',
    icon: <DatabaseOutlined />,
    severity: 'critical',
    symptoms: [
      'Error: "disk full" или "out of space"',
      'Невозможно создать новые документы',
      'Supabase Dashboard показывает 95%+ использования',
    ],
    diagnosis: [
      'Проверить размер таблиц: SELECT * FROM check_database_size()',
      'Проверить Supabase Dashboard → Database → Usage',
      'Идентифицировать самые большие таблицы',
    ],
    solution: [
      'Удалить старые документы: DELETE FROM documents WHERE created_at < NOW() - INTERVAL \'6 months\'',
      'Удалить дубликаты: DELETE FROM documents WHERE is_duplicate = true',
      'Архивировать старые search_runs',
      'Увеличить план Supabase (если нужно)',
    ],
    prevention: [
      'Настройте автоматическое архивирование (каждые 3 месяца)',
      'Мониторьте размер БД ежемесячно',
      'Удаляйте дубликаты еженедельно',
      'Используйте партиционирование для больших таблиц',
    ],
  },
  {
    id: 'cron-not-running',
    title: 'pg_cron job не запускается',
    icon: <ClockCircleOutlined />,
    severity: 'warning',
    symptoms: [
      'Pipeline не запускается автоматически',
      'cleanup-stuck-runs не работает',
      'cron.job.active = false',
    ],
    diagnosis: [
      'Проверить: SELECT * FROM cron.job WHERE jobname IN (\'run-sql-source-hunter\', \'cleanup-stuck-runs\')',
      'Проверить логи: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10',
      'Убедиться, что pg_cron extension включён',
    ],
    solution: [
      'Активировать job: UPDATE cron.job SET active = true WHERE jobname = \'<job_name>\'',
      'Пересоздать job (см. миграцию 035_setup_pg_cron.sql)',
      'Проверить права доступа для cron schema',
      'Убедиться, что функция существует и доступна',
    ],
    prevention: [
      'Мониторьте статус pg_cron jobs ежедневно',
      'Настройте уведомления при падении jobs',
      'Тестируйте изменения в cron jobs на staging',
    ],
  },
];

/**
 * Компонент руководства по устранению неполадок
 */
export const TroubleshootingGuide: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');

  // Filter scenarios based on search
  const filteredScenarios = React.useMemo(() => {
    if (!searchTerm.trim()) return scenarios;

    const term = searchTerm.toLowerCase();
    return scenarios.filter(
      (scenario) =>
        scenario.title.toLowerCase().includes(term) ||
        scenario.symptoms.some((s) => s.toLowerCase().includes(term)) ||
        scenario.diagnosis.some((d) => d.toLowerCase().includes(term)) ||
        scenario.solution.some((s) => s.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header & Search */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>Troubleshooting Guide</Title>
            <Paragraph type="secondary">
              Поиск решений для типичных проблем. Всего сценариев: {scenarios.length}
            </Paragraph>
            <Input
              size="large"
              placeholder="Поиск по симптомам, диагностике, решениям..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
            {filteredScenarios.length === 0 && (
              <Alert
                message="Ничего не найдено"
                description="Попробуйте изменить поисковый запрос"
                type="info"
                showIcon
              />
            )}
          </Space>
        </Card>

        {/* Scenarios */}
        <Collapse accordion>
          {filteredScenarios.map((scenario) => (
            <Panel
              key={scenario.id}
              header={
                <Space>
                  {scenario.icon}
                  <Text strong>{scenario.title}</Text>
                  <Tag color={getSeverityColor(scenario.severity)}>
                    {scenario.severity === 'critical' ? 'КРИТИЧНО' : scenario.severity === 'warning' ? 'ВНИМАНИЕ' : 'ИНФО'}
                  </Tag>
                </Space>
              }
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* Symptoms */}
                <div>
                  <Title level={5}>
                    <WarningOutlined /> Симптомы
                  </Title>
                  <ul>
                    {scenario.symptoms.map((symptom, idx) => (
                      <li key={idx}>
                        <Text>{symptom}</Text>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Diagnosis */}
                <div>
                  <Title level={5}>
                    <SearchOutlined /> Диагностика
                  </Title>
                  <ul>
                    {scenario.diagnosis.map((diag, idx) => (
                      <li key={idx}>
                        <Text code={diag.includes('SELECT') || diag.includes('UPDATE')}>
                          {diag}
                        </Text>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Solution */}
                <div>
                  <Title level={5}>
                    <BugOutlined /> Решение
                  </Title>
                  <Alert
                    message="Шаги для устранения проблемы"
                    type="success"
                    description={
                      <ol>
                        {scenario.solution.map((sol, idx) => (
                          <li key={idx}>
                            <Text code={sol.includes('UPDATE') || sol.includes('DELETE')}>
                              {sol}
                            </Text>
                          </li>
                        ))}
                      </ol>
                    }
                  />
                </div>

                {/* Prevention */}
                <div>
                  <Title level={5}>
                    <WarningOutlined /> Профилактика
                  </Title>
                  <Alert
                    message="Как избежать в будущем"
                    type="info"
                    description={
                      <ul>
                        {scenario.prevention.map((prev, idx) => (
                          <li key={idx}>
                            <Text>{prev}</Text>
                          </li>
                        ))}
                      </ul>
                    }
                  />
                </div>
              </Space>
            </Panel>
          ))}
        </Collapse>
      </Space>
    </div>
  );
};

export default TroubleshootingGuide;
