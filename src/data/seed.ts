import {
  AppSettings,
  CalendarEvent,
  CalendarSource,
  NoteFolder,
  NoteItem,
  PassVaultData,
  ProfileMeta,
  SharedGroup,
  VoiceRecord,
  WorkspaceSnapshot,
} from '../types';

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, days: number): Date {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function createDefaultSettings(): AppSettings {
  return {
    theme: 'light',
    layoutMode: 'auto',
    uiScale: 1,
    fontScale: 1,
    showNotebooksInSidebar: true,
    showSchedulePanel: true,
    statusStripPosition: 'bottom',
    mobileNavMode: 'always',
    enabledModules: {
      notes: true,
      passwords: true,
      calendar: true,
      shared: true,
      voice: true,
      dock: true,
    },
    clipboardClearSec: 30,
    passAutoLockMin: 5,
    syncEndpoint: 'https://webdav.yandex.ru/svod-vault/',
    syncPreset: 'local',
    autoSyncOnEdit: true,
    dock: {
      enabledOverlay: false,
      edge: 'bottom',
      iconSize: 46,
      opacity: 0.94,
      fisheye: true,
      items: [
        { id: 'dk-1', label: 'Заметки', targetType: 'module', target: 'notes', color: '#4F46E5' },
        { id: 'dk-2', label: 'Календарь', targetType: 'module', target: 'calendar', color: '#059669' },
        { id: 'dk-3', label: 'Пароли', targetType: 'module', target: 'passwords', color: '#D97706' },
        { id: 'dk-4', label: 'Общая папка', targetType: 'module', target: 'shared', color: '#0284C7' },
        { id: 'dk-5', label: 'Диктовка', targetType: 'module', target: 'voice', color: '#DC2626' },
      ],
    },
  };
}

export function createDefaultProfiles(): ProfileMeta[] {
  return [
    {
      id: 'profile-main',
      name: 'Основной профиль',
      login: 'alex',
      avatarColor: '#4F46E5',
      storageType: 'local',
      storageEndpoint: 'data/profile-main.enc',
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      hasPassword: false,
      remembered: true,
    },
  ];
}

export function createSeedWorkspace(): WorkspaceSnapshot {
  const now = new Date();
  const todayStr = formatIsoDate(now);
  const tomorrowStr = formatIsoDate(addDays(now, 1));
  const in2DaysStr = formatIsoDate(addDays(now, 2));
  const in4DaysStr = formatIsoDate(addDays(now, 4));

  const folders: NoteFolder[] = [
    { id: 'f-inbox', name: 'Входящие', parentId: null, createdAt: now.toISOString() },
    { id: 'f-work', name: 'Проекты', parentId: null, createdAt: now.toISOString() },
    { id: 'f-work-arch', name: 'Архитектура', parentId: 'f-work', createdAt: now.toISOString() },
    { id: 'f-finance', name: 'Финансы и таблицы', parentId: null, createdAt: now.toISOString() },
    { id: 'f-personal', name: 'Личное', parentId: null, createdAt: now.toISOString() },
  ];

  const notes: NoteItem[] = [
    {
      id: 'n-welcome',
      folderId: 'f-work',
      title: 'План релиза v1.0 и архитектура',
      tags: ['релиз', 'архитектура'],
      isFavorite: true,
      isPinned: true,
      isTrashed: false,
      author: 'Алексей',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      versions: [
        {
          id: 'ver-1',
          savedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          title: 'План релиза v1.0 (черновик)',
          blocks: [
            {
              id: 'b-old-1',
              type: 'markdown',
              content: 'Первичный набросок архитектуры хранения на базе AES-256-GCM и атомарной записи.',
            },
          ],
        },
      ],
      blocks: [
        {
          id: 'b-w-1',
          type: 'markdown',
          content:
            '## Ключевые задачи спринта\n\nОсновной принцип хранения — локальные зашифрованные файлы с атомарной записью и откатом на `.bak`. Подробности расчётов см. в [[Бюджет квартала и расходы]].\n\n- [x] Настроить три независимых контура ключей (AES-256-GCM + PBKDF2 100 000 итераций)\n- [x] Собрать единый редактор заметок, чек-листов и встроенных таблиц\n- [ ] Проверить дельта-синхронизацию через WebDAV и расписание бэкапов\n- [ ] Подготовить экспорт заметок в Markdown и .ics-событий в календарь\n\nИспользуйте ==выделение важных фрагментов==, теги #релиз #архитектура и ссылки вида [[Чек-лист безопасности]].',
        },
        {
          id: 'b-w-2',
          type: 'ics',
          events: [
            {
              uid: 'ics-demo-1',
              summary: 'Ревью архитектуры хранилища и криптографии',
              dtStart: `${tomorrowStr}T11:00`,
              dtEnd: `${tomorrowStr}T12:00`,
              location: 'Переговорная №2 / Zoom',
              description: 'Проверка атомарного сохранения и формата бэкапов.',
            },
          ],
        },
      ],
    },
    {
      id: 'n-budget',
      folderId: 'f-finance',
      title: 'Бюджет квартала и расходы',
      tags: ['финансы', 'таблица'],
      isFavorite: true,
      isPinned: false,
      isTrashed: false,
      author: 'Алексей',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      versions: [],
      blocks: [
        {
          id: 'b-fin-1',
          type: 'markdown',
          content:
            'Сводка расходов прямо внутри заметки без переключения между редакторами. Поддерживаются формулы `=СУММ(B2:B5)`, `=СРЗНАЧ(B2:B5)`, `=МАКС(...)`, `=МИН(...)` и арифметика между ячейками. Связано с [[План релиза v1.0 и архитектура]].',
        },
        {
          id: 'b-fin-table',
          type: 'table',
          data: {
            id: 'tbl-q4',
            title: 'Инфраструктура и сервисы (₽)',
            rows: 7,
            cols: 4,
            cells: {
              A1: { value: 'Статья расходов', bold: true, bg: '#EEF2FF' },
              B1: { value: 'План', bold: true, bg: '#EEF2FF' },
              C1: { value: 'Факт', bold: true, bg: '#EEF2FF' },
              D1: { value: 'Остаток', bold: true, bg: '#EEF2FF' },
              A2: { value: 'WebDAV / Облако' },
              B2: { value: '4500' },
              C2: { value: '3900' },
              D2: { value: '=B2-C2' },
              A3: { value: 'Домены и сертификаты' },
              B3: { value: '2800' },
              C3: { value: '2800' },
              D3: { value: '=B3-C3' },
              A4: { value: 'Сервер бэкапов' },
              B4: { value: '8200' },
              C4: { value: '7600' },
              D4: { value: '=B4-C4' },
              A5: { value: 'Тестовые устройства' },
              B5: { value: '15000' },
              C5: { value: '12400' },
              D5: { value: '=B5-C5' },
              A6: { value: 'Итого', bold: true, bg: '#FEF3C7' },
              B6: { value: '=СУММ(B2:B5)', bold: true, bg: '#FEF3C7' },
              C6: { value: '=СУММ(C2:C5)', bold: true, bg: '#FEF3C7' },
              D6: { value: '=СУММ(D2:D5)', bold: true, bg: '#FEF3C7' },
              A7: { value: 'Средний расход', bold: true },
              B7: { value: '=СРЗНАЧ(B2:B5)' },
              C7: { value: '=СРЗНАЧ(C2:C5)' },
              D7: { value: '=МАКС(D2:D5)' },
            },
          },
        },
      ],
    },
    {
      id: 'n-security',
      folderId: 'f-work-arch',
      title: 'Чек-лист безопасности',
      tags: ['безопасность', 'архитектура'],
      isFavorite: false,
      isPinned: false,
      isTrashed: false,
      author: 'Алексей',
      createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      versions: [],
      blocks: [
        {
          id: 'b-sec-1',
          type: 'markdown',
          content:
            '### Контуры ключей и защита данных\n\n- [x] Профиль и заметки шифруются отдельным ключом\n- [x] Хранилища паролей изолированы собственными мастер-паролями\n- [x] Брутфорс-защита: блокировка на 1 минуту после 10 неверных попыток\n- [x] Автоочистка буфера обмена по таймеру (30 секунд)\n- [ ] Проверить восстановление из страховочной копии `safety/`',
        },
        {
          id: 'b-sec-2',
          type: 'code',
          language: 'typescript',
          content:
            '// Атомарная схема записи (.tmp -> .bak -> основной файл)\nwriteAtomic(path, encryptedPayload);\n// При чтении с повреждением выполняется автоматический откат на .bak\nconst valid = readValid(path);',
        },
      ],
    },
    {
      id: 'n-inbox-1',
      folderId: 'f-inbox',
      title: 'Быстрые идеи по интерфейсу',
      tags: ['идеи', 'дизайн'],
      isFavorite: false,
      isPinned: false,
      isTrashed: false,
      author: 'Алексей',
      createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
      versions: [],
      blocks: [
        {
          id: 'b-inb-1',
          type: 'markdown',
          content:
            '1. Перестановка колонок в ThreePane стрелками `← / →` и скрытие лишних панелей.\n2. Двойной клик по дню в сетке месяца сразу открывает создание события.\n3. Горячие клавиши масштаба `Ctrl +`, `Ctrl -`, `Ctrl 0` для комфортной работы на разных мониторах.',
        },
        {
          id: 'b-inb-2',
          type: 'quote',
          content: 'Хороший инструмент для заметок не мешает думать: данные на диске принадлежат только вам.',
          author: 'Принцип локального хранения',
        },
      ],
    },
    {
      id: 'n-personal-1',
      folderId: 'f-personal',
      title: 'Список книг и материалов',
      tags: ['личное'],
      isFavorite: false,
      isPinned: false,
      isTrashed: false,
      author: 'Алексей',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
      versions: [],
      blocks: [
        {
          id: 'b-per-1',
          type: 'markdown',
          content:
            '- [x] Designing Data-Intensive Applications — Мартин Клеппман\n- [ ] Cryptography Engineering — Нильс Фергюсон, Брюс Шнайер\n- [ ] Принципы локально-ориентированного ПО (Local-First Software)',
        },
      ],
    },
  ];

  const calendars: CalendarSource[] = [
    { id: 'cal-work', name: 'Работа', color: '#4F46E5', visible: true },
    { id: 'cal-personal', name: 'Личный', color: '#059669', visible: true },
    { id: 'cal-important', name: 'Важные даты', color: '#D97706', visible: true },
  ];

  const events: CalendarEvent[] = [
    {
      id: 'ev-1',
      calendarId: 'cal-work',
      title: 'Планирование недели и разбор задач',
      date: todayStr,
      startTime: '10:00',
      endTime: '11:00',
      location: 'Рабочий кабинет',
      description: 'Сверка по модулю заметок и формулам в таблицах.',
      reminderMinutes: 15,
    },
    {
      id: 'ev-2',
      calendarId: 'cal-work',
      title: 'Созвон по синхронизации WebDAV',
      date: todayStr,
      startTime: '14:30',
      endTime: '15:30',
      location: 'Видеозвонок',
      description: 'Тестирование дельта-обмена по manifest.json.',
      reminderMinutes: 10,
    },
    {
      id: 'ev-3',
      calendarId: 'cal-personal',
      title: 'Тренировка и прогулка',
      date: todayStr,
      startTime: '18:30',
      endTime: '19:45',
      reminderMinutes: 30,
    },
    {
      id: 'ev-4',
      calendarId: 'cal-important',
      title: 'Плановый зашифрованный бэкап профиля',
      date: tomorrowStr,
      startTime: '12:00',
      endTime: '12:30',
      description: 'Проверка восстановления из архива.',
      reminderMinutes: 15,
    },
    {
      id: 'ev-5',
      calendarId: 'cal-work',
      title: 'Демо модуля паролей и импорта CSV',
      date: in2DaysStr,
      startTime: '16:00',
      endTime: '17:00',
      reminderMinutes: 15,
    },
    {
      id: 'ev-6',
      calendarId: 'cal-personal',
      title: 'Встреча с друзьями',
      date: in4DaysStr,
      startTime: '19:00',
      endTime: '21:30',
      location: 'Центр города',
      reminderMinutes: 60,
    },
  ];

  const sharedGroups: SharedGroup[] = [
    {
      id: 'grp-team',
      name: 'Команда разработки',
      webdavUrl: 'https://webdav.yandex.ru/svod-shared/team/',
      folderPath: '/shared/team',
      encryptionKeyFingerprint: 'A4:19:F2:8C:70:3D:E1:5B',
      members: [
        { id: 'm-1', name: 'Алексей (вы)', role: 'editor', lastOnline: 'В сети', isOwner: true },
        { id: 'm-2', name: 'Мария К.', role: 'editor', lastOnline: '12 мин назад' },
        { id: 'm-3', name: 'Дмитрий В.', role: 'contributor', lastOnline: '2 ч назад' },
        { id: 'm-4', name: 'Ольга С.', role: 'viewer', lastOnline: 'Вчера' },
      ],
      messages: [
        {
          id: 'msg-1',
          author: 'Мария К.',
          text: 'Загрузила обновлённую схему ключей для общей папки. Проверьте, пожалуйста, перед релизом.',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
        {
          id: 'msg-2',
          author: 'Дмитрий В.',
          text: 'Предлагаю завтра в 15:00 провести короткую сверку по импорту таблиц и календаря .ics.',
          createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
        },
        {
          id: 'msg-3',
          author: 'Алексей (вы)',
          text: 'Отлично, добавил пункт в заметку по релизу и перенесу встречу в расписание.',
          createdAt: new Date(Date.now() - 1200000).toISOString(),
        },
      ],
      docs: [
        {
          id: 'sdoc-1',
          title: 'Регламент резервного копирования',
          content:
            'Все критичные профили сохраняются в зашифрованный архив с ротацией последних 5 страховочных копий в папке safety/.',
          author: 'Мария К.',
          updatedAt: new Date(Date.now() - 7200000).toISOString(),
          comments: [
            {
              id: 'sc-1',
              author: 'Дмитрий В.',
              text: 'Добавим также автоматическую проверку целостности перед откатом.',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ],
        },
      ],
    },
  ];

  const voiceHistory: VoiceRecord[] = [
    {
      id: 'vr-1',
      text: 'Напомнить проверить экспорт в Markdown и формулу среднего значения в таблице бюджета.',
      durationSec: 8,
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      engine: 'browser-speech',
    },
  ];

  return {
    folders,
    notes,
    calendars,
    events,
    sharedGroups,
    voiceHistory,
    settings: createDefaultSettings(),
  };
}

export function createSeedPassVaultData(): PassVaultData {
  const now = new Date().toISOString();
  const older = new Date(Date.now() - 86400000 * 12).toISOString();
  return {
    folders: [
      { id: 'pf-work', name: 'Работа и серверы', sortOverride: null },
      { id: 'pf-mail', name: 'Почта и облако', sortOverride: null },
      { id: 'pf-finance', name: 'Банки и карты', sortOverride: null },
    ],
    sort: { field: 'title', dir: 'asc', favoritesFirst: true },
    entries: [
      {
        id: 'pe-1',
        folderId: 'pf-mail',
        title: 'Яндекс Диск (WebDAV)',
        username: 'alex.workspace@yandex.ru',
        password: 'Xk9#mP2$vL8!qR4w',
        url: 'https://webdav.yandex.ru',
        notes: 'Пароль приложения для синхронизации зашифрованного хранилища.',
        extraFields: [
          { id: 'ef-1', label: 'Точка WebDAV', value: '/svod-vault/', hidden: false },
        ],
        history: [{ password: 'OldPass2025!#a', changedAt: older }],
        isFavorite: true,
        isTrashed: false,
        createdAt: older,
        updatedAt: now,
      },
      {
        id: 'pe-2',
        folderId: 'pf-work',
        title: 'Сервер бэкапов SSH',
        username: 'backup-admin',
        password: 'G7!nT5@bM2#kV9^zW3',
        url: 'ssh://192.168.10.42:2222',
        notes: 'Основной домашний сервер для ночных копий.',
        extraFields: [
          { id: 'ef-2', label: 'PIN-код доступа', value: '482910', hidden: true },
        ],
        history: [],
        isFavorite: true,
        isTrashed: false,
        createdAt: older,
        updatedAt: now,
      },
      {
        id: 'pe-3',
        folderId: 'pf-work',
        title: 'Git-репозиторий (тест)',
        username: 'alex-dev',
        password: 'qwerty123',
        url: 'https://git.local.net',
        notes: 'Пример записи со слабым паролем для проверки аудита.',
        extraFields: [],
        history: [],
        isFavorite: false,
        isTrashed: false,
        createdAt: older,
        updatedAt: older,
      },
      {
        id: 'pe-4',
        folderId: 'pf-finance',
        title: 'Корпоративная карта',
        username: 'alex@company.ru',
        password: 'qwerty123',
        url: 'https://bank.example.ru',
        notes: 'Пример повторяющегося пароля — аудит подсветит совпадение.',
        extraFields: [
          { id: 'ef-3', label: 'Номер карты', value: '4276 5500 1234 9876', hidden: true },
          { id: 'ef-4', label: 'PIN-код', value: '7391', hidden: true },
        ],
        history: [],
        isFavorite: false,
        isTrashed: false,
        createdAt: older,
        updatedAt: older,
      },
    ],
  };
}
