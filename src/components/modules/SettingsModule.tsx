import React, { useRef, useState } from 'react';
import {
  Activity,
  Calendar,
  Cloud,
  Download,
  FileText,
  KeyRound,
  Mic,
  Monitor,
  RotateCcw,
  Shield,
  Sliders,
  Upload,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../context/AppStore';
import { LayoutMode, MobileNavMode, ModuleId, StatusStripPosition } from '../../types';

type SettingsSection =
  | 'general'
  | 'sync'
  | 'notes'
  | 'calendar'
  | 'shared'
  | 'passwords'
  | 'voice'
  | 'desktop'
  | 'debug';

export const SettingsModule: React.FC = () => {
  const {
    settings,
    updateSettings,
    toggleModuleEnabled,
    isMobileView,
    safetyBackups,
    createSafetyBackup,
    restoreSafetyBackup,
    exportEncryptedProfileBackup,
    importEncryptedProfileBackup,
    triggerSync,
    setDiagOpen,
    pushToast,
  } = useAppStore();

  const [section, setSection] = useState<SettingsSection>('general');
  const [backupPw, setBackupPw] = useState('');
  const [restorePw, setRestorePw] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const allNavItems: { id: SettingsSection; label: string; icon: React.ReactNode; desktopOnly?: boolean }[] = [
    { id: 'general', label: 'Основные', icon: <Sliders className="w-4 h-4" /> },
    { id: 'sync', label: 'Синхронизация и бэкап', icon: <Cloud className="w-4 h-4" /> },
    { id: 'notes', label: 'Заметки', icon: <FileText className="w-4 h-4" /> },
    { id: 'calendar', label: 'Календарь', icon: <Calendar className="w-4 h-4" /> },
    { id: 'shared', label: 'Общая папка', icon: <Users className="w-4 h-4" /> },
    { id: 'passwords', label: 'Пароли', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'voice', label: 'Голос', icon: <Mic className="w-4 h-4" /> },
    { id: 'desktop', label: 'Компьютер', icon: <Monitor className="w-4 h-4" />, desktopOnly: true },
    { id: 'debug', label: 'Отладка', icon: <Activity className="w-4 h-4" /> },
  ];
  const navItems = allNavItems.filter((item) => !(item.desktopOnly && isMobileView));

  const moduleLabels: { id: Exclude<ModuleId, 'settings'>; label: string }[] = [
    { id: 'notes', label: 'Заметки и таблицы' },
    { id: 'passwords', label: 'Пароли' },
    { id: 'calendar', label: 'Календарь и напоминания' },
    { id: 'shared', label: 'Общая папка и чат' },
    { id: 'voice', label: 'Диктовка' },
    { id: 'dock', label: 'Док быстрого запуска' },
  ];

  const handleExportBackup = async () => {
    if (backupPw.length < 4) {
      pushToast('Задайте пароль для шифрования бэкапа (от 4 символов)', 'warn');
      return;
    }
    const payload = await exportEncryptedProfileBackup(backupPw);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svod-backup-${new Date().toISOString().slice(0, 10)}.enc.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupPw('');
    pushToast('Зашифрованный бэкап сохранён', 'success');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!restorePw) {
      pushToast('Введите пароль расшифровки перед выбором файла', 'warn');
      e.target.value = '';
      return;
    }
    const txt = await file.text();
    const res = await importEncryptedProfileBackup(txt, restorePw);
    if (!res.ok) pushToast(res.error || 'Ошибка восстановления', 'error');
    else setRestorePw('');
    e.target.value = '';
  };

  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json,.enc"
        onChange={handleImportBackup}
        className="hidden"
      />

      {/* Settings Categories Sidebar */}
      <div className="w-[220px] border-r border-[var(--divider)] bg-[var(--sidebar)] p-2.5 space-y-0.5 overflow-y-auto shrink-0">
        <div className="px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted)]">
          Разделы настроек
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`w-full px-2.5 py-2 rounded-[8px] flex items-center gap-2.5 text-[13px] transition-colors ${
              section === item.id
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-5">
          {section === 'general' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">Основные настройки</h2>

              {/* Theme & Layout */}
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-4 text-[13px]">
                <div className="flex items-center justify-between gap-4">
                  <span>Тема оформления</span>
                  <div className="flex p-0.5 rounded-[8px] bg-[var(--sidebar)] text-[12px]">
                    <button
                      type="button"
                      onClick={() => updateSettings({ theme: 'light' })}
                      className={`px-3 py-1 rounded-[6px] ${
                        settings.theme === 'light'
                          ? 'bg-[var(--panel)] text-[var(--text)] font-medium shadow-xs'
                          : 'text-[var(--text2)]'
                      }`}
                    >
                      Светлая
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ theme: 'dark' })}
                      className={`px-3 py-1 rounded-[6px] ${
                        settings.theme === 'dark'
                          ? 'bg-[var(--panel)] text-[var(--text)] font-medium shadow-xs'
                          : 'text-[var(--text2)]'
                      }`}
                    >
                      Тёмная
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Режим раскладки</span>
                  <select
                    value={settings.layoutMode}
                    onChange={(e) => updateSettings({ layoutMode: e.target.value as LayoutMode })}
                    className="px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  >
                    <option value="auto">Авто (&gt;= 900 px компьютер)</option>
                    <option value="desktop">Всегда компьютер</option>
                    <option value="mobile">Всегда телефон</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Глобальная строка статуса (StatusStrip)</span>
                  <select
                    value={settings.statusStripPosition}
                    onChange={(e) =>
                      updateSettings({ statusStripPosition: e.target.value as StatusStripPosition })
                    }
                    className="px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  >
                    <option value="bottom">Снизу экрана</option>
                    <option value="top">Сверху экрана</option>
                    <option value="sync-only">Только при синхронизации</option>
                    <option value="hidden">Скрыта</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span>Нижняя панель в мобильном виде</span>
                  <select
                    value={settings.mobileNavMode}
                    onChange={(e) =>
                      updateSettings({ mobileNavMode: e.target.value as MobileNavMode })
                    }
                    className="px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  >
                    <option value="always">Всегда показывать</option>
                    <option value="hide-on-scroll">Прятать при прокрутке вниз</option>
                    <option value="hidden">Скрыть</option>
                  </select>
                </div>
              </div>

              {/* Dual Independent Scaling */}
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-4 text-[13px]">
                <div className="font-semibold text-[var(--text)]">Независимое масштабирование</div>
                <div>
                  <div className="flex justify-between text-[12px] text-[var(--text2)] mb-1">
                    <span>Масштаб всего интерфейса (uiScale · Ctrl + / − / 0)</span>
                    <span className="font-mono-tabular text-[var(--text)]">
                      {Math.round(settings.uiScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={160}
                    step={5}
                    value={Math.round(settings.uiScale * 100)}
                    onChange={(e) => updateSettings({ uiScale: Number(e.target.value) / 100 })}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[12px] text-[var(--text2)] mb-1">
                    <span>Масштаб текста и редактора (fontScale)</span>
                    <span className="font-mono-tabular text-[var(--text)]">
                      {Math.round(settings.fontScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={80}
                    max={160}
                    step={5}
                    value={Math.round(settings.fontScale * 100)}
                    onChange={(e) => updateSettings({ fontScale: Number(e.target.value) / 100 })}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Modular Architecture Toggle */}
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2.5 text-[13px]">
                <div className="font-semibold text-[var(--text)]">Активные модули</div>
                <p className="text-[12px] text-[var(--text2)] m-0">
                  Отключённые модули не отображаются в навигации и не загружаются.
                </p>
                <div className="divide-y divide-[var(--divider)]">
                  {moduleLabels.map((m) => (
                    <label
                      key={m.id}
                      className="py-2 flex items-center justify-between cursor-pointer"
                    >
                      <span className="text-[var(--text)]">{m.label}</span>
                      <input
                        type="checkbox"
                        checked={settings.enabledModules[m.id]}
                        onChange={() => toggleModuleEnabled(m.id)}
                        className="svod-checkbox"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'sync' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">
                Синхронизация и бэкапы
              </h2>

              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3 text-[13px]">
                <div className="font-semibold text-[var(--text)]">Хранилище синхронизации</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11.5px] text-[var(--text2)] mb-1">Пресет</label>
                    <select
                      value={settings.syncPreset}
                      onChange={(e) => {
                        const val = e.target.value as typeof settings.syncPreset;
                        const endpoint =
                          val === 'yandex'
                            ? 'https://webdav.yandex.ru/svod-vault/'
                            : val === 'mailru'
                            ? 'https://webdav.cloud.mail.ru/svod-vault/'
                            : val === 'gdrive'
                            ? 'gdrive://appDataFolder/svod'
                            : val === 'local'
                            ? 'data/local-sync/'
                            : settings.syncEndpoint;
                        updateSettings({ syncPreset: val, syncEndpoint: endpoint });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                    >
                      <option value="local">Локальная папка</option>
                      <option value="yandex">WebDAV — Яндекс Диск</option>
                      <option value="mailru">WebDAV — Облако Mail.ru</option>
                      <option value="webdav">Свой WebDAV-сервер</option>
                      <option value="gdrive">Google Диск (drive.file)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11.5px] text-[var(--text2)] mb-1">Адрес</label>
                    <input
                      value={settings.syncEndpoint}
                      onChange={(e) => updateSettings({ syncEndpoint: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] font-mono-tabular text-[12px] outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoSyncOnEdit}
                      onChange={(e) => updateSettings({ autoSyncOnEdit: e.target.checked })}
                      className="svod-checkbox"
                    />
                    <span>Дельта-синхронизация после правок</span>
                  </label>
                  <button
                    type="button"
                    onClick={triggerSync}
                    className="px-3.5 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium"
                  >
                    Синхронизировать
                  </button>
                </div>
              </div>

              {/* Encrypted Backup Export / Import */}
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3 text-[13px]">
                <div className="font-semibold text-[var(--text)] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--success)]" />
                  Полный зашифрованный бэкап профиля (AES-256-GCM)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={backupPw}
                    onChange={(e) => setBackupPw(e.target.value)}
                    placeholder="Пароль для архива..."
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="px-3.5 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[12.5px] font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Экспорт .enc
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--divider)]">
                  <input
                    type="password"
                    value={restorePw}
                    onChange={(e) => setRestorePw(e.target.value)}
                    placeholder="Пароль расшифровки..."
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] text-[12.5px] font-medium flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Восстановить из .enc
                  </button>
                </div>
              </div>

              {/* Safety Copies (last 5) */}
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text)]">
                    Страховочные копии safety/ ({safetyBackups.length}/5)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      createSafetyBackup('Ручной снимок из настроек');
                      pushToast('Страховочная копия создана', 'success');
                    }}
                    className="text-[12px] text-[var(--accent)] hover:underline"
                  >
                    + Создать снимок
                  </button>
                </div>
                {safetyBackups.length === 0 ? (
                  <div className="text-[12px] text-[var(--muted)]">
                    Автоматически создаются перед импортом, восстановлением и сбросом.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {safetyBackups.map((b) => (
                      <div
                        key={b.id}
                        className="px-3 py-2 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] flex items-center justify-between gap-2 text-[12px]"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text)] truncate">{b.reason}</div>
                          <div className="text-[11px] text-[var(--muted)] font-mono-tabular">
                            {new Date(b.createdAt).toLocaleString('ru-RU')} ·{' '}
                            {(b.sizeBytes / 1024).toFixed(1)} КБ
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => restoreSafetyBackup(b.id)}
                          className="text-[var(--accent)] hover:underline flex items-center gap-1 shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Откатить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {section === 'notes' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">Заметки и таблицы</h2>
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3 text-[13px]">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Показывать блок «Блокноты» в левой боковой панели</span>
                  <input
                    type="checkbox"
                    checked={settings.showNotebooksInSidebar}
                    onChange={(e) =>
                      updateSettings({ showNotebooksInSidebar: e.target.checked })
                    }
                    className="svod-checkbox"
                  />
                </label>
                <div className="text-[12px] text-[var(--text2)] pt-2 border-t border-[var(--divider)]">
                  Корзина хранит удалённые заметки 30 дней. История версий сохраняет до 8 снимков на заметку.
                </div>
              </div>
            </>
          )}

          {section === 'calendar' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">Календарь и расписание</h2>
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3 text-[13px]">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Показывать правую панель расписания (при ширине &gt;= 980 px)</span>
                  <input
                    type="checkbox"
                    checked={settings.showSchedulePanel}
                    onChange={(e) => updateSettings({ showSchedulePanel: e.target.checked })}
                    className="svod-checkbox"
                  />
                </label>
              </div>
            </>
          )}

          {section === 'passwords' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">Безопасность паролей</h2>
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-4 text-[13px]">
                <div className="flex items-center justify-between gap-4">
                  <span>Автоочистка буфера обмена (секунд, 0 = выкл.)</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={settings.clipboardClearSec}
                    onChange={(e) =>
                      updateSettings({ clipboardClearSec: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-24 px-2.5 py-1 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] font-mono-tabular outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Автоблокировка по бездействию (минут, 0 = никогда)</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={settings.passAutoLockMin}
                    onChange={(e) =>
                      updateSettings({ passAutoLockMin: Math.max(0, Number(e.target.value)) })
                    }
                    className="w-24 px-2.5 py-1 rounded-[8px] border border-[var(--divider)] bg-[var(--bg)] text-[var(--text)] font-mono-tabular outline-none"
                  />
                </div>
                <div className="text-[12px] text-[var(--text2)] pt-2 border-t border-[var(--divider)]">
                  Хранилище также автоматически блокируется при сворачивании окна/вкладки. После 10 неверных попыток ввода мастер-пароля включается блокировка на 1 минуту.
                </div>
              </div>
            </>
          )}

          {(section === 'shared' || section === 'voice' || section === 'desktop') && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">
                {section === 'shared'
                  ? 'Общая папка'
                  : section === 'voice'
                  ? 'Голос и диктовка'
                  : 'Компьютер и горячие клавиши'}
              </h2>
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] text-[13px] text-[var(--text2)] space-y-2">
                {section === 'shared' && (
                  <p className="m-0">
                    Каждая общая группа использует независимый ключ шифрования и изолированную папку на WebDAV-сервере. Управление правами участников и приглашениями выполняется внутри модуля «Общая папка».
                  </p>
                )}
                {section === 'voice' && (
                  <p className="m-0">
                    Диктовка использует встроенное распознавание речи браузера (ru-RU) с автоматическим копированием расшифровки в буфер обмена и журналом записей.
                  </p>
                )}
                {section === 'desktop' && (
                  <div className="space-y-2 text-[var(--text)]">
                    <div className="font-medium">Горячие клавиши десктоп-режима</div>
                    <div className="grid grid-cols-2 gap-2 text-[12.5px] font-mono-tabular text-[var(--text2)]">
                      <div>Ctrl + / Ctrl − / Ctrl 0</div>
                      <div>Масштаб интерфейса (80%–160%)</div>
                      <div>Ctrl + A (в Паролях)</div>
                      <div>Выделить все записи списка</div>
                      <div>Двойной клик по дню</div>
                      <div>Быстрое создание события</div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {section === 'debug' && (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">Отладка и диагностика</h2>
              <div className="p-4 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] space-y-3 text-[13px]">
                <p className="text-[var(--text2)] m-0">
                  Окно диагностики (DiagHub) отображает живой журнал операций хранилища, историю синхронизаций и журнал ошибок.
                </p>
                <button
                  type="button"
                  onClick={() => setDiagOpen(true)}
                  className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium"
                >
                  Открыть DiagHub
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
