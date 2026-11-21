import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../context/AppStore';
import { ModuleId } from '../../types';

interface MenuItemDef {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export const AppMenu: React.FC<{
  onNewNote?: () => void;
  onExportCurrentNote?: () => void;
  onImportNote?: () => void;
}> = ({ onNewNote, onExportCurrentNote, onImportNote }) => {
  const {
    activeProfile,
    setActiveModule,
    settings,
    updateSettings,
    adjustUiScale,
    resetUiScale,
    triggerSync,
    lockProfile,
    setDiagOpen,
    createFolder,
    createNote,
    selectedFolderFilter,
    setSelectedFolderFilter,
    selectedNoteId,
    notes,
    updateNote,
    deleteNoteToTrash,
    createSafetyBackup,
    pushToast,
  } = useAppStore();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const currentNote = notes.find((n) => n.id === selectedNoteId);

  const handleNewNote = () => {
    setActiveModule('notes');
    if (onNewNote) {
      onNewNote();
    } else {
      const folderId =
        selectedFolderFilter !== 'all' &&
        selectedFolderFilter !== 'favorites' &&
        selectedFolderFilter !== 'trash' &&
        !selectedFolderFilter.startsWith('tag:')
          ? selectedFolderFilter
          : null;
      createNote(folderId);
    }
  };

  const menus: Record<string, MenuItemDef[]> = {
    Файл: [
      { label: 'Новая заметка', shortcut: 'Ctrl+N', action: handleNewNote },
      {
        label: 'Новый блокнот',
        action: () => {
          setActiveModule('notes');
          const f = createFolder(`Блокнот ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
          setSelectedFolderFilter(f.id);
          pushToast(`Создан блокнот «${f.name}»`, 'success');
        },
      },
      { divider: true, label: '' },
      { label: 'Импорт заметки (.md / .txt)', action: () => { setActiveModule('notes'); onImportNote?.(); } },
      { label: 'Экспорт текущей заметки (.md)', disabled: !currentNote, action: () => onExportCurrentNote?.() },
      {
        label: 'Создать страховочную копию (safety/)',
        action: () => {
          createSafetyBackup('Ручная страховочная копия из меню');
          pushToast('Страховочная копия сохранена', 'success');
        },
      },
      { divider: true, label: '' },
      { label: 'Синхронизировать сейчас', shortcut: 'Ctrl+S', action: triggerSync },
      { label: 'Заблокировать профиль', shortcut: 'Ctrl+L', action: lockProfile },
    ],
    Правка: [
      {
        label: 'Отменить',
        shortcut: 'Ctrl+Z',
        action: () => document.execCommand('undo'),
      },
      {
        label: 'Повторить',
        shortcut: 'Ctrl+Y',
        action: () => document.execCommand('redo'),
      },
      { divider: true, label: '' },
      {
        label: 'Выделить всё',
        shortcut: 'Ctrl+A',
        action: () => document.execCommand('selectAll'),
      },
    ],
    Вид: [
      {
        label: settings.theme === 'dark' ? 'Светлая тема' : 'Тёмная тема',
        action: () => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        label: settings.showNotebooksInSidebar ? 'Скрыть блокноты в сайдбаре' : 'Показать блокноты в сайдбаре',
        action: () => updateSettings({ showNotebooksInSidebar: !settings.showNotebooksInSidebar }),
      },
      {
        label: settings.showSchedulePanel ? 'Скрыть панель расписания' : 'Показать панель расписания',
        action: () => updateSettings({ showSchedulePanel: !settings.showSchedulePanel }),
      },
      { divider: true, label: '' },
      { label: 'Увеличить масштаб интерфейса', shortcut: 'Ctrl +', action: () => adjustUiScale(0.05) },
      { label: 'Уменьшить масштаб интерфейса', shortcut: 'Ctrl −', action: () => adjustUiScale(-0.05) },
      { label: 'Сбросить масштаб (100%)', shortcut: 'Ctrl 0', action: resetUiScale },
      { divider: true, label: '' },
      {
        label: 'Переключить на мобильный вид',
        action: () => updateSettings({ layoutMode: 'mobile' }),
      },
    ],
    Переход: (
      [
        { id: 'notes' as ModuleId, label: 'Заметки и таблицы' },
        { id: 'passwords' as ModuleId, label: 'Пароли' },
        { id: 'calendar' as ModuleId, label: 'Календарь и напоминания' },
        { id: 'shared' as ModuleId, label: 'Общая папка и чат' },
        { id: 'voice' as ModuleId, label: 'Диктовка' },
        { id: 'dock' as ModuleId, label: 'Док' },
        { id: 'settings' as ModuleId, label: 'Настройки' },
      ] as { id: ModuleId; label: string }[]
    ).map((m) => ({
      label: m.label,
      disabled: m.id !== 'settings' && !settings.enabledModules[m.id],
      action: () => setActiveModule(m.id),
    })),
    Блокноты: [
      {
        label: 'Все заметки',
        action: () => {
          setActiveModule('notes');
          setSelectedFolderFilter('all');
        },
      },
      {
        label: 'Избранное',
        action: () => {
          setActiveModule('notes');
          setSelectedFolderFilter('favorites');
        },
      },
      {
        label: 'Корзина',
        action: () => {
          setActiveModule('notes');
          setSelectedFolderFilter('trash');
        },
      },
      { divider: true, label: '' },
      {
        label: 'Создать новый блокнот',
        action: () => {
          setActiveModule('notes');
          const f = createFolder('Новый блокнот');
          setSelectedFolderFilter(f.id);
        },
      },
    ],
    Заметка: [
      {
        label: currentNote?.isPinned ? 'Открепить заметку' : 'Закрепить заметку',
        disabled: !currentNote,
        action: () =>
          currentNote && updateNote(currentNote.id, (n) => ({ ...n, isPinned: !n.isPinned })),
      },
      {
        label: currentNote?.isFavorite ? 'Убрать из избранного' : 'В избранное',
        disabled: !currentNote,
        action: () =>
          currentNote && updateNote(currentNote.id, (n) => ({ ...n, isFavorite: !n.isFavorite })),
      },
      {
        label: 'Сохранить снимок версии',
        disabled: !currentNote,
        action: () => {
          if (!currentNote) return;
          updateNote(currentNote.id, (n) => n, true);
          pushToast('Версия заметки сохранена в историю (до 8 снимков)', 'success');
        },
      },
      { divider: true, label: '' },
      {
        label: 'Удалить в корзину',
        disabled: !currentNote,
        action: () => currentNote && deleteNoteToTrash(currentNote.id),
      },
    ],
    Сервис: [
      { label: 'Синхронизация (дельта-обмен)', action: triggerSync },
      { label: 'Окно диагностики (DiagHub)', action: () => setDiagOpen(true) },
      { label: 'Параметры и модули', action: () => setActiveModule('settings') },
    ],
    Помощь: [
      {
        label: 'Горячие клавиши масштаба (Ctrl + / − / 0)',
        action: () => pushToast('Масштаб: Ctrl+ / Ctrl− / Ctrl0 · Заметка: Ctrl+N', 'info'),
      },
      { label: 'О программе «Свод»', action: () => setAboutOpen(true) },
    ],
  };

  return (
    <>
      <div
        ref={barRef}
        className="h-8 px-2 flex items-center justify-between border-b border-[var(--divider)] bg-[var(--sidebar)] select-none shrink-0 text-[12px]"
      >
        <div className="flex items-center gap-0.5">
          <span className="font-semibold text-[var(--text)] px-2 mr-1 tracking-tight whitespace-nowrap shrink-0">
            Свод
          </span>
          {Object.keys(menus).map((name) => {
            const isOpen = openMenu === name;
            return (
              <div key={name} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu(isOpen ? null : name)}
                  onMouseEnter={() => {
                    if (openMenu) setOpenMenu(name);
                  }}
                  className={`px-2 py-1 rounded-[6px] transition-colors whitespace-nowrap shrink-0 ${
                    isOpen
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                      : 'text-[var(--text2)] hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {name}
                </button>
                {isOpen && (
                  <div className="absolute left-0 top-full mt-0.5 min-w-[240px] py-1 rounded-[10px] border border-[var(--divider)] bg-[var(--panel)] shadow-lg z-50">
                    {menus[name].map((item, idx) =>
                      item.divider ? (
                        <div key={idx} className="my-1 border-t border-[var(--divider)]" />
                      ) : (
                        <button
                          key={idx}
                          type="button"
                          disabled={item.disabled}
                          onClick={() => {
                            item.action?.();
                            setOpenMenu(null);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center justify-between gap-4 text-[12.5px] text-[var(--text)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                          <span className="truncate">{item.label}</span>
                          {item.shortcut && (
                            <span className="text-[11px] text-[var(--muted)] font-mono-tabular shrink-0">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 pr-2 text-[11.5px] text-[var(--text2)]">
          <span className="truncate max-w-[160px]">{activeProfile.name}</span>
          <span aria-hidden="true" className="text-[var(--divider)]">
            ·
          </span>
          <span className="font-mono-tabular">{Math.round(settings.uiScale * 100)}%</span>
        </div>
      </div>

      {aboutOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[var(--divider)] bg-[var(--panel)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[var(--text)] mb-1">
              Свод — Личное зашифрованное пространство
            </h3>
            <p className="text-[13px] text-[var(--text2)] leading-relaxed mb-4">
              Модульная система для заметок с таблицами, календаря, зашифрованных хранилищ паролей и
              общих папок. Шифрование AES-256-GCM с PBKDF2-HMAC-SHA256 (100 000 итераций) и
              атомарной записью с откатом на резервную копию .bak.
            </p>
            <div className="text-[12px] text-[var(--text2)] space-y-1 border-t border-[var(--divider)] pt-3 mb-4">
              <div>Активный профиль: {activeProfile.name}</div>
              <div>Режим хранения: {activeProfile.storageEndpoint || 'Локальное хранилище'}</div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                className="px-4 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
